/**
 * scan_drive_setcards.js
 * 
 * Scans all candidate folders in Google Drive root folder.
 * For students with multiple setcards (PDFs), picks the one where the folder
 * also has video AND photo (best), then video only, then photo only, then any PDF.
 * Updates CHECKLIST Candidate Cards column (setcard link) for students missing it.
 * Also updates photo and video links in CHECKLIST if missing.
 * 
 * SAFE: only uses values.update on specific cells, never appends.
 */

const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';
const ROOT_FOLDER_ID = '1bjsmFAXZ-B5Kq1Lpc0gIt0A-9LYNXbjB';

// Normalize name for matching: lowercase, remove accents/special chars
function norm(str) {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]/g, '');
}

// Convert 0-indexed column to A1 letter notation
function colLetter(col) {
    let letter = '';
    let temp = col + 1;
    while (temp > 0) {
        const rem = (temp - 1) % 26;
        letter = String.fromCharCode(65 + rem) + letter;
        temp = Math.floor((temp - 1) / 26);
    }
    return letter;
}

async function run() {
    const drive = google.drive({ version: 'v3', auth: serviceAccountClient });
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });

    // --- Step 1: Load CHECKLIST ---
    console.log('Loading CHECKLIST...');
    const clRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'CHECKLIST!A1:BH200'
    });
    const clRows = clRes.data.values || [];
    const hdrIdx = clRows.findIndex(r => r && r.some(c => c && c.trim().toLowerCase().replace(/\s/g, '') === 'studentid'));
    if (hdrIdx === -1) { console.error('Header not found'); return; }
    const hdrs = clRows[hdrIdx];

    const idCol    = hdrs.findIndex(h => h && h.trim().toLowerCase().replace(/\s/g,'') === 'studentid');
    const nameCol  = hdrs.findIndex(h => h && h.trim().toLowerCase() === 'student name');
    const shortCol = hdrs.findIndex(h => h && h.trim().toLowerCase() === 'short name');
    const cardCol  = hdrs.findIndex(h => h && (h.trim().toLowerCase() === 'candidate cards' || h.trim().toLowerCase() === 'setcard'));
    const photoCol = hdrs.findIndex(h => h && (h.trim().toLowerCase() === 'photo' || h.trim().toLowerCase() === 'photo link'));
    const videoCol = hdrs.findIndex(h => h && h.trim().toLowerCase() === 'introduction video');


    console.log(`Cols: id=${idCol}, name=${nameCol}, short=${shortCol}, card=${cardCol}, photo=${photoCol}, video=${videoCol}`);

    // Build name → {rowIndex, id, hasSetcard, hasPhoto, hasVideo} map
    const studentByName = {};
    const students = [];
    for (let i = hdrIdx + 1; i < clRows.length; i++) {
        const row = clRows[i] || [];
        const id = row[idCol] || '';
        if (!id) continue;
        const fullName  = row[nameCol] || '';
        const shortName = row[shortCol] || '';
        const setcard   = cardCol !== -1 ? (row[cardCol] || '') : '';
        const photo     = photoCol !== -1 ? (row[photoCol] || '') : '';
        const video     = videoCol !== -1 ? (row[videoCol] || '') : '';
        
        const entry = { rowIndex: i, id, setcard, photo, video };
        students.push(entry);
        
        // Register all normalized name variants
        [fullName, shortName, id].forEach(n => {
            if (n) studentByName[norm(n)] = entry;
        });
        // Also register just the given+family from ID: ANG_Tinh_NGUYEN_26.09.2005 → "TinhNGUYEN"
        const idParts = id.split('_');
        if (idParts.length >= 3) {
            const lastPart = idParts[idParts.length - 1];
            const hasDOB = /\d/.test(lastPart);
            const familyIdx = hasDOB ? idParts.length - 2 : idParts.length - 1;
            const givenPart = idParts[1];
            const familyPart = idParts[familyIdx];
            if (givenPart && familyPart) {
                studentByName[norm(givenPart + familyPart)] = entry;
                studentByName[norm(familyPart + givenPart)] = entry;
            }
        }
    }
    console.log(`Loaded ${students.length} students.`);

    // --- Step 2: Scan Drive folders ---
    console.log('\nScanning Drive...');
    let pageToken = null;
    const allFolders = [];
    do {
        const res = await drive.files.list({
            q: `'${ROOT_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'nextPageToken, files(id, name)',
            pageSize: 200,
            pageToken: pageToken || undefined
        });
        allFolders.push(...(res.data.files || []));
        pageToken = res.data.nextPageToken;
    } while (pageToken);
    console.log(`Found ${allFolders.length} folders in Drive.`);

    // --- Step 3: For each folder, get files and match to student ---
    // candidateData: normName → { pdfLink, photoLink, videoLink, score }
    // score: has both video+photo=3, photo only=2, video only=1, just pdf=0
    const candidateData = {}; // normName → best match so far

    for (const folder of allFolders) {
        const folderName = folder.name;
        
        // Get files in this folder
        const filesRes = await drive.files.list({
            q: `'${folder.id}' in parents and trashed=false`,
            fields: 'files(id, name, mimeType, webViewLink)',
            pageSize: 50
        });
        const files = filesRes.data.files || [];
        
        const pdfs   = files.filter(f => f.mimeType === 'application/pdf');
        const imgs   = files.filter(f => f.mimeType && f.mimeType.startsWith('image/'));
        const vids   = files.filter(f => f.mimeType && f.mimeType.startsWith('video/'));
        
        if (pdfs.length === 0) continue; // No setcard PDF → skip
        
        const pdfLink   = pdfs[0].webViewLink;
        const photoLink = imgs.length > 0 ? imgs[0].webViewLink : '';
        const videoLink = vids.length > 0 ? vids[0].webViewLink : '';
        const score = (photoLink ? 2 : 0) + (videoLink ? 1 : 0);
        
        // Try to match folder name to a student
        // Strip leading numbers, brackets, etc.
        const cleanName = folderName
            .replace(/^\d+[\.\s]*/,'')    // remove leading "1. " etc.
            .replace(/\(.*?\)/g, '')      // remove parentheses
            .replace(/v\d+$/i, '')        // remove version suffix like "v2"
            .trim();
        
        const normFolder = norm(cleanName);
        
        // Try various lookup keys derived from folder name
        let student = studentByName[normFolder];
        if (!student) {
            // Try word subsets (given name + family name combinations)
            const words = cleanName.split(/\s+/);
            for (let a = 0; a < words.length && !student; a++) {
                for (let b = 0; b < words.length && !student; b++) {
                    if (a !== b) {
                        student = studentByName[norm(words[a] + words[b])];
                    }
                }
            }
        }
        
        if (!student) {
            console.log(`  [NO MATCH] "${folderName}" (norm: ${normFolder})`);
            continue;
        }
        
        const key = student.id;
        const existing = candidateData[key];
        if (!existing || score > existing.score) {
            candidateData[key] = { student, pdfLink, photoLink, videoLink, score, folderName };
            if (existing) {
                console.log(`  [UPGRADED] ${student.id}: score ${existing.score}→${score} (folder: ${folderName})`);
            } else {
                console.log(`  [MATCHED] "${folderName}" → ${student.id} | pdf:✓ photo:${photoLink?'✓':'✗'} video:${videoLink?'✓':'✗'}`);
            }
        }
    }

    // --- Step 4: Build update list ---
    console.log('\nBuilding updates...');
    const updates = [];

    for (const [studentId, data] of Object.entries(candidateData)) {
        const { student, pdfLink, photoLink, videoLink, folderName } = data;
        const sheetRow = student.rowIndex + 1; // 1-indexed sheet row

        // Only update if value is currently missing
        if (!student.setcard && pdfLink && cardCol !== -1) {
            updates.push({ range: `CHECKLIST!${colLetter(cardCol)}${sheetRow}`, values: [[pdfLink]] });
            console.log(`  SetcardLink: ${studentId} → ${pdfLink.slice(0, 60)}`);
        }
        if (!student.photo && photoLink && photoCol !== -1) {
            updates.push({ range: `CHECKLIST!${colLetter(photoCol)}${sheetRow}`, values: [[photoLink]] });
            console.log(`  PhotoLink:   ${studentId}`);
        }
        if (!student.video && videoLink && videoCol !== -1) {
            updates.push({ range: `CHECKLIST!${colLetter(videoCol)}${sheetRow}`, values: [[videoLink]] });
            console.log(`  VideoLink:   ${studentId}`);
        }
    }

    if (updates.length === 0) {
        console.log('Nothing to update — all students already have setcard links or no matches found.');
        return;
    }

    // --- Step 5: Apply updates ---
    await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { valueInputOption: 'USER_ENTERED', data: updates }
    });
    console.log(`\n✓ Applied ${updates.length} update(s) to CHECKLIST.`);
}

run().catch(e => console.error('Error:', e.message));
