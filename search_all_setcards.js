/**
 * search_all_setcards.js
 * Searches broadly across all Drive accessible to the service account
 * for PDF files, then tries to match them to students in CHECKLIST.
 */
const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';
const ROOT_FOLDER_ID = '1bjsmFAXZ-B5Kq1Lpc0gIt0A-9LYNXbjB';
const DRY_RUN = process.argv[2] !== '--write'; // default: dry run, pass --write to actually update


function norm(str) {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '');
}

async function listFoldersRecursive(drive, folderId, depth = 0) {
    const res = await drive.files.list({
        q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        pageSize: 200
    });
    const folders = res.data.files || [];
    const result = folders.map(f => ({ ...f, depth }));
    for (const f of folders) {
        if (depth < 3) { // max 3 levels deep
            const sub = await listFoldersRecursive(drive, f.id, depth + 1);
            result.push(...sub);
        }
    }
    return result;
}

async function run() {
    const drive = google.drive({ version: 'v3', auth: serviceAccountClient });
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });

    // Load CHECKLIST
    console.log('Loading CHECKLIST...');
    const clRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID, range: 'CHECKLIST!A1:BH200'
    });
    const clRows = clRes.data.values || [];
    const hdrIdx = clRows.findIndex(r => r && r.some(c => c && c.trim().toLowerCase().replace(/\s/g,'') === 'studentid'));
    const hdrs = clRows[hdrIdx];
    const idCol    = hdrs.findIndex(h => h && h.trim().toLowerCase().replace(/\s/g,'') === 'studentid');
    const nameCol  = hdrs.findIndex(h => h && h.trim().toLowerCase() === 'student name');
    const shortCol = hdrs.findIndex(h => h && h.trim().toLowerCase() === 'short name');
    const cardCol  = hdrs.findIndex(h => h && (h.trim().toLowerCase() === 'candidate cards' || h.trim().toLowerCase() === 'setcard'));
    const photoCol = hdrs.findIndex(h => h && (h.trim().toLowerCase() === 'photo' || h.trim().toLowerCase() === 'photo link'));
    const videoCol = hdrs.findIndex(h => h && h.trim().toLowerCase() === 'introduction video');


    function colLetter(col) {
        let letter = '', temp = col + 1;
        while (temp > 0) { const r = (temp-1)%26; letter = String.fromCharCode(65+r)+letter; temp = Math.floor((temp-1)/26); }
        return letter;
    }

    const studentMap = {}; // normKey → {rowIndex, id, setcard, photo, video}
    const students = [];
    for (let i = hdrIdx + 1; i < clRows.length; i++) {
        const row = clRows[i] || [];
        const id = row[idCol] || '';
        if (!id) continue;
        const entry = {
            rowIndex: i, id,
            setcard: cardCol !== -1 ? (row[cardCol] || '') : '',
            photo:   photoCol !== -1 ? (row[photoCol] || '') : '',
            video:   videoCol !== -1 ? (row[videoCol] || '') : ''
        };
        students.push(entry);

        // Register name lookups
        [row[nameCol], row[shortCol]].forEach(n => { if (n) studentMap[norm(n)] = entry; });
        // From ID: ANG_Tinh_NGUYEN_26.09.2005 → "TinhNGUYEN", "NGUYENTinh"
        const p = id.split('_');
        if (p.length >= 3) {
            const lastIsDate = /\d/.test(p[p.length-1]);
            const famIdx = lastIsDate ? p.length-2 : p.length-1;
            const given = p[1], family = p[famIdx];
            if (given && family) {
                studentMap[norm(given+family)] = entry;
                studentMap[norm(family+given)] = entry;
                // NOTE: no single-name fallback — too risky (many students share first names)
            }
        }
    }
    const studentsNeedingSetcard = students.filter(s => !s.setcard);
    console.log(`${students.length} students total, ${studentsNeedingSetcard.length} need setcard.`);

    // Search all PDFs accessible to service account (including Shared Drives)
    console.log('\nSearching Drive for all PDFs (including Shared Drives)...');
    let pageToken = null;
    const allPDFs = [];
    do {
        const res = await drive.files.list({
            q: `mimeType='application/pdf' and trashed=false`,
            fields: 'nextPageToken, files(id, name, webViewLink, parents)',
            pageSize: 200,
            pageToken: pageToken || undefined,
            includeItemsFromAllDrives: true,
            supportsAllDrives: true,
            corpora: 'allDrives'
        });
        allPDFs.push(...(res.data.files || []));
        pageToken = res.data.nextPageToken;

    } while (pageToken);
    console.log(`Found ${allPDFs.length} PDF files total.`);

    // Get parent folder info for each PDF (to know siblings: photo, video)
    // Group PDFs by parent folder
    const folderPDFs = {}; // folderId → [pdf files]
    for (const pdf of allPDFs) {
        const parentId = (pdf.parents || [])[0];
        if (parentId) {
            if (!folderPDFs[parentId]) folderPDFs[parentId] = [];
            folderPDFs[parentId].push(pdf);
        }
    }

    // For each unique parent folder, get all files
    const folderContents = {};
    console.log(`Checking ${Object.keys(folderPDFs).length} unique folders with PDFs...`);
    for (const folderId of Object.keys(folderPDFs)) {
        const fr = await drive.files.list({
            q: `'${folderId}' in parents and trashed=false`,
            fields: 'files(id, name, mimeType, webViewLink)', pageSize: 50
        });
        folderContents[folderId] = fr.data.files || [];
    }

    // Try to match each PDF to a student
    // candidateMatches: studentId → best { pdfLink, photoLink, videoLink, score, fileName }
    const candidateMatches = {};

    for (const pdf of allPDFs) {
        // Extract the "name" portion from the PDF filename
        // Pattern: "YEN TRAN -ZFA-Setcard_.pdf" → try "YEN TRAN" first
        let rawName = pdf.name.replace(/\.pdf$/i, '').trim();
        
        // Strategy 1: everything before the first " -" (dash with space)
        const dashIdx = rawName.indexOf(' -');
        const namePart1 = dashIdx !== -1 ? rawName.slice(0, dashIdx).trim() : rawName;
        
        // Strategy 2: strip known suffixes (Setcard, ZFA, NSL, etc.)
        const namePart2 = rawName
            .replace(/[-_]?setcard[-_]?/gi, '')
            .replace(/\b(ZFA|FSJ|PFLEGE|ANG|HDEU|EI|NSL|DIE|LA|NW)\b/gi, '')
            .replace(/\(.*?\)/g, '')
            .replace(/[-_]+/g, ' ')
            .trim();

        const pdfNorm1 = norm(namePart1);
        const pdfNorm2 = norm(namePart2);

        const parentId = (pdf.parents || [])[0];
        const siblings = parentId ? (folderContents[parentId] || []) : [];
        const photoLink = (siblings.find(f => f.mimeType && f.mimeType.startsWith('image/')) || {}).webViewLink || '';
        const videoLink = (siblings.find(f => f.mimeType && f.mimeType.startsWith('video/')) || {}).webViewLink || '';
        const score = (photoLink ? 2 : 0) + (videoLink ? 1 : 0);

        // Try to match using multiple strategies
        let student = studentMap[pdfNorm1] || studentMap[pdfNorm2];

        if (!student) {
            // Try word combinations from each strategy
            for (const normStr of [pdfNorm1, pdfNorm2]) {
                const words = normStr.replace(/[^a-z]/g, ' ').trim().split(/\s+/).filter(w => w.length > 1);
                for (let a = 0; a < words.length && !student; a++) {
                    student = studentMap[words[a]];
                    for (let b = 0; b < words.length && !student; b++) {
                        if (a !== b) student = studentMap[words[a]+words[b]];
                    }
                }
            }
        }

        if (student) {
            const existing = candidateMatches[student.id];
            if (!existing || score > existing.score) {
                candidateMatches[student.id] = { student, pdfLink: pdf.webViewLink, photoLink, videoLink, score, fileName: pdf.name };
                if (!existing) console.log(`  MATCH: "${pdf.name}" → ${student.id} [score:${score}]`);
                else console.log(`  UPGRADE: "${pdf.name}" → ${student.id} [${existing.score}→${score}]`);
            }
        } else {
            console.log(`  NO MATCH: "${pdf.name}" (tried: ${pdfNorm1} / ${pdfNorm2})`);

        }
    }

    // Build updates
    const updates = [];
    const preview = [];
    for (const [sid, data] of Object.entries(candidateMatches)) {
        const { student, pdfLink, photoLink, videoLink, fileName } = data;
        const r = student.rowIndex + 1;
        let changed = [];
        if (!student.setcard && pdfLink && cardCol !== -1) {
            updates.push({ range: `CHECKLIST!${colLetter(cardCol)}${r}`, values: [[pdfLink]] });
            changed.push('SetcardLink');
        }
        if (!student.photo && photoLink && photoCol !== -1) {
            updates.push({ range: `CHECKLIST!${colLetter(photoCol)}${r}`, values: [[photoLink]] });
            changed.push('Photo');
        }
        if (!student.video && videoLink && videoCol !== -1) {
            updates.push({ range: `CHECKLIST!${colLetter(videoCol)}${r}`, values: [[videoLink]] });
            changed.push('Video');
        }
        if (changed.length > 0) {
            preview.push(`  ${student.id.padEnd(40)} ← ${changed.join('+')}  ("${fileName}")`);
        }
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`PREVIEW — ${preview.length} students to update, ${updates.length} cells:`);
    console.log('='.repeat(70));
    preview.forEach(p => console.log(p));

    if (updates.length === 0) {
        console.log('\nNothing to update.');
        return;
    }

    if (DRY_RUN) {
        console.log(`\n⚠️  DRY RUN — nothing written. Run with --write to apply.`);
        console.log('   node search_all_setcards.js --write');
        
        // Show students still unmatched (no setcard found anywhere in Drive)
        const matchedIds = new Set(Object.keys(candidateMatches));
        const stillMissing = students.filter(s => !s.setcard && !matchedIds.has(s.id));
        if (stillMissing.length > 0) {
            console.log(`\n${'='.repeat(70)}`);
            console.log(`STILL MISSING setcard (${stillMissing.length} students — not found in Drive):`);
            console.log('='.repeat(70));
            stillMissing.forEach(s => console.log(`  ${s.id}`));
        }
        return;
    }


    await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { valueInputOption: 'USER_ENTERED', data: updates }
    });
    console.log(`\n✓ Applied ${updates.length} update(s). ${Object.keys(candidateMatches).length} students matched.`);
}
run().catch(e => console.error('Error:', e.message));

