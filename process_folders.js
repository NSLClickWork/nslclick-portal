const fs = require('fs');
const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');
const pdf = require('pdf-parse');
require('dotenv').config();

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';
const ROOT_FOLDER_ID = '1bjsmFAXZ-B5Kq1Lpc0gIt0A-9LYNXbjB';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function norm(str) {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '');
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGemini(text) {
    const prompt = `Extract candidate information from text into JSON. Requirements:
{"Name": "Full name", "Profession": "Profession like Pflege, Koch, etc.", "Score": "NSL Score (number)", "Grade": "NSL Grade (A/B/C/S)", "S1": "Superpower 1 (German)", "S2": "Superpower 2 (German)", "S3": "Superpower 3 (German)", "Level": "German level (default B1 unless B2 is found)", "Avail": "Availability date MM/YYYY"}
Return STRICTLY valid JSON ONLY. NO MARKDOWN.
Text: ${text}`;

    let attempts = 0;
    while (attempts < 3) {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });
        const data = await res.json();
        try {
            const textRes = data.candidates[0].content.parts[0].text;
            return JSON.parse(textRes);
        } catch(e) {
            if (data.error && data.error.code === 429) {
                console.log("Rate limit hit, waiting 20s...");
                await sleep(20000);
                attempts++;
            } else {
                console.log("Failed to parse Gemini output:", data);
                return null;
            }
        }
    }
    return null;
}

async function run() {
    const drive = google.drive({ version: 'v3', auth: serviceAccountClient });
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });

    // 1. Fetch existing CHECKLIST
    const clRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'CHECKLIST!A1:Z600' });
    const clRows = clRes.data.values;
    const clHdrIdx = clRows.findIndex(r => r.some(c => c && c.trim().toLowerCase().replace(/\s/g,'') === 'studentid'));
    const clHdrs = clRows[clHdrIdx];
    const clIdCol = clHdrs.findIndex(h => h && h.trim().toLowerCase().replace(/\s/g,'') === 'studentid');
    const clNameCol = clHdrs.findIndex(h => h && h.trim().toLowerCase() === 'student name');
    const clShortCol = clHdrs.findIndex(h => h && h.trim().toLowerCase() === 'short name');
    const clCenterCol = clHdrs.findIndex(h => h && (h.trim().toLowerCase() === 'language school' || h.trim().toLowerCase() === 'center code'));
    const clProfCol = clHdrs.findIndex(h => h && (h.trim().toLowerCase() === 'profession' || h.trim().toLowerCase() === 'profession code' || h.trim().toLowerCase() === 'professioncode'));
    
    const existingMap = {};
    for (let i = clHdrIdx + 1; i < clRows.length; i++) {
        const r = clRows[i];
        if (!r) continue;
        const id = r[clIdCol];
        if (!id) continue;
        const name = norm(r[clNameCol]);
        const short = norm(r[clShortCol]);
        if (name) existingMap[name] = id;
        if (short) existingMap[short] = id;
    }

    // 2. Fetch NSL-ASSESS and NSL-SKILL
    const asRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'NSL-ASSESS!A1:Z600' });
    const asRows = asRes.data.values;
    const asHdrIdx = asRows.findIndex(r => r.some(c => c && c.trim() === 'STUDENT ID'));
    const asHdrs = asRows[asHdrIdx];
    
    const skRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'NSL-SKILL!A1:Z600' });
    const skRows = skRes.data.values;
    const skHdrIdx = skRows.findIndex(r => r.some(c => c && c.trim().toLowerCase().replace(/\s/g,'') === 'studentid'));
    const skHdrs = skRows[skHdrIdx];

    const findRowById = (rows, hdrIdx, idColIdx, id) => {
        for (let i = hdrIdx + 1; i < rows.length; i++) {
            if (rows[i] && rows[i][idColIdx] === id) return i;
        }
        return -1;
    };

    // 3. List folders in Drive
    const foldersRes = await drive.files.list({
        q: `'${ROOT_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder'`,
        fields: 'files(id, name)'
    });
    const folders = foldersRes.data.files;
    console.log(`Found ${folders.length} candidate folders.`);

    const updates = [];
    const clAppends = [];
    const asAppends = [];
    const skAppends = [];

    // Skip the ones we already successfully processed
    const alreadyProcessedNames = ['Nhi PHAM', 'Trang BUI', 'Huyen PHAM', 'Thi NGUYEN'];
    const alreadyProcessedLower = alreadyProcessedNames.map(n => norm(n));

    for (const folder of folders) {
        if (folder.name.includes('Reduced Video')) continue; // Skip random folders
        
        console.log(`\nProcessing folder: ${folder.name}`);
        const filesRes = await drive.files.list({
            q: `'${folder.id}' in parents`,
            fields: 'files(id, name, mimeType, webViewLink)'
        });
        const files = filesRes.data.files;
        
        const pdfFile = files.find(f => f.mimeType === 'application/pdf');
        const imgFile = files.find(f => f.mimeType.startsWith('image/'));
        const vidFile = files.find(f => f.mimeType.startsWith('video/'));

        if (!pdfFile) {
            console.log(`No PDF found in ${folder.name}`);
            continue;
        }

        console.log(`Downloading PDF ${pdfFile.name}...`);
        const pdfDataRes = await drive.files.get({ fileId: pdfFile.id, alt: 'media' }, { responseType: 'arraybuffer' });
        const pdfText = (await pdf(Buffer.from(pdfDataRes.data))).text;

        const extracted = await callGemini(pdfText);
        if (!extracted) {
             console.log("Failed extraction for " + folder.name);
             continue;
        }
        console.log(`Extracted: ${extracted.Name} | ${extracted.Score} ${extracted.Grade} | ${extracted.Level}`);

        if (alreadyProcessedLower.includes(norm(extracted.Name))) {
            console.log(`Skipping ${extracted.Name} because already processed successfully.`);
            continue;
        }

        let matchedId = existingMap[norm(extracted.Name)];
        if (!matchedId) {
            const folderNameNorm = norm(folder.name.replace(/^[0-9.]+\s*/, '').replace(/\(.*\)/, ''));
            matchedId = existingMap[folderNameNorm];
        }

        let center = 'ANG';
        if (folder.name.includes('HDEU')) center = 'HDEU';
        else if (folder.name.includes('EI')) center = 'EI';

        const parts = (extracted.Name || '').trim().split(/\s+/);
        let shortName = '';
        if (parts.length >= 2) {
            const ho = parts[0].toUpperCase();
            const ten = parts[parts.length - 1];
            shortName = ten.charAt(0).toUpperCase() + ten.slice(1).toLowerCase() + ' ' + ho;
        }

        let studentId = matchedId;
        if (!studentId) {
            studentId = `${center}_${shortName.replace(/\s+/g, '_')}_NEW`.toUpperCase();
            console.log(`Candidate ${extracted.Name} NOT found. Creating ID: ${studentId}`);
            
            const row = Array(clHdrs.length).fill('');
            row[clIdCol] = studentId;
            row[clNameCol] = extracted.Name;
            if (clShortCol !== -1) row[clShortCol] = shortName;
            if (clCenterCol !== -1) row[clCenterCol] = center;
            if (clProfCol !== -1) row[clProfCol] = extracted.Profession;
            clAppends.push(row);
        } else {
            console.log(`Candidate ${extracted.Name} matched to ID: ${studentId}`);
            const rIdx = findRowById(clRows, clHdrIdx, clIdCol, studentId);
            if (rIdx !== -1 && clProfCol !== -1 && (!clRows[rIdx][clProfCol] || clRows[rIdx][clProfCol].trim() === '')) {
                updates.push({
                    range: `CHECKLIST!${String.fromCharCode(65 + clProfCol)}${rIdx + 1}`,
                    values: [[extracted.Profession]]
                });
            }
        }

        // NSL-ASSESS
        const asIdColIdx = asHdrs.indexOf('STUDENT ID');
        const asScoreColIdx = asHdrs.indexOf('NSL SCORE');
        const asGradeColIdx = asHdrs.indexOf('NSL GRADE');
        const asGerColIdx = asHdrs.indexOf('CURRENT GERMAN LEVEL');
        const asNameColIdx = asHdrs.indexOf('STUDENT NAME');

        const asRowIdx = findRowById(asRows, asHdrIdx, asIdColIdx, studentId);
        if (asRowIdx !== -1) {
            const r = asRowIdx + 1;
            const currScore = parseInt(asRows[asRowIdx][asScoreColIdx]) || 0;
            const newScore = parseInt(extracted.Score) || 0;
            if (newScore > currScore) {
                if (asScoreColIdx !== -1) updates.push({ range: `NSL-ASSESS!${String.fromCharCode(65 + asScoreColIdx)}${r}`, values: [[extracted.Score]] });
                if (asGradeColIdx !== -1) updates.push({ range: `NSL-ASSESS!${String.fromCharCode(65 + asGradeColIdx)}${r}`, values: [[extracted.Grade]] });
            }
            if (asGerColIdx !== -1 && (!asRows[asRowIdx][asGerColIdx] || asRows[asRowIdx][asGerColIdx].trim() === '')) {
                updates.push({ range: `NSL-ASSESS!${String.fromCharCode(65 + asGerColIdx)}${r}`, values: [[extracted.Level]] });
            }
        } else {
            const row = Array(asHdrs.length).fill('');
            if (asIdColIdx !== -1) row[asIdColIdx] = studentId;
            if (asNameColIdx !== -1) row[asNameColIdx] = extracted.Name;
            if (asScoreColIdx !== -1) row[asScoreColIdx] = extracted.Score;
            if (asGradeColIdx !== -1) row[asGradeColIdx] = extracted.Grade;
            if (asGerColIdx !== -1) row[asGerColIdx] = extracted.Level;
            asAppends.push(row);
        }

        // NSL-SKILL
        const skIdColIdx = skHdrs.findIndex(h => h && h.trim().toLowerCase().replace(/\s/g,'') === 'studentid');
        const skNameColIdx = skHdrs.findIndex(h => h && h.trim().toLowerCase() === 'student name');
        const skS1Idx = skHdrs.findIndex(h => h && h.trim().toLowerCase() === 'superpower 1');
        const skS2Idx = skHdrs.findIndex(h => h && h.trim().toLowerCase() === 'superpower 2');
        const skS3Idx = skHdrs.findIndex(h => h && h.trim().toLowerCase() === 'superpower 3');
        const skAvailIdx = skHdrs.findIndex(h => h && h.trim().toLowerCase() === 'availability');
        const skPhotoIdx = skHdrs.findIndex(h => h && h.trim().toLowerCase() === 'photo link');
        const skVidIdx = skHdrs.findIndex(h => h && (h.trim().toLowerCase() === 'introduction video' || h.trim().toLowerCase() === 'youtube link'));
        const skCardIdx = skHdrs.findIndex(h => h && (h.trim().toLowerCase() === 'candidate cards' || h.trim().toLowerCase() === 'setcardlink'));

        const skRowIdx = findRowById(skRows, skHdrIdx, skIdColIdx, studentId);
        if (skRowIdx !== -1) {
            const r = skRowIdx + 1;
            if (skS1Idx !== -1) updates.push({ range: `NSL-SKILL!${String.fromCharCode(65 + skS1Idx)}${r}`, values: [[extracted.S1]] });
            if (skS2Idx !== -1) updates.push({ range: `NSL-SKILL!${String.fromCharCode(65 + skS2Idx)}${r}`, values: [[extracted.S2]] });
            if (skS3Idx !== -1) updates.push({ range: `NSL-SKILL!${String.fromCharCode(65 + skS3Idx)}${r}`, values: [[extracted.S3]] });
            if (skAvailIdx !== -1) updates.push({ range: `NSL-SKILL!${String.fromCharCode(65 + skAvailIdx)}${r}`, values: [[extracted.Avail]] });
            if (skPhotoIdx !== -1 && imgFile) updates.push({ range: `NSL-SKILL!${String.fromCharCode(65 + skPhotoIdx)}${r}`, values: [[imgFile.webViewLink]] });
            if (skVidIdx !== -1 && vidFile) updates.push({ range: `NSL-SKILL!${String.fromCharCode(65 + skVidIdx)}${r}`, values: [[vidFile.webViewLink]] });
            if (skCardIdx !== -1 && pdfFile) updates.push({ range: `NSL-SKILL!${String.fromCharCode(65 + skCardIdx)}${r}`, values: [[pdfFile.webViewLink]] });
        } else {
            const row = Array(skHdrs.length).fill('');
            if (skIdColIdx !== -1) row[skIdColIdx] = studentId;
            if (skNameColIdx !== -1) row[skNameColIdx] = extracted.Name;
            if (skS1Idx !== -1) row[skS1Idx] = extracted.S1;
            if (skS2Idx !== -1) row[skS2Idx] = extracted.S2;
            if (skS3Idx !== -1) row[skS3Idx] = extracted.S3;
            if (skAvailIdx !== -1) row[skAvailIdx] = extracted.Avail;
            if (skPhotoIdx !== -1 && imgFile) row[skPhotoIdx] = imgFile.webViewLink;
            if (skVidIdx !== -1 && vidFile) row[skVidIdx] = vidFile.webViewLink;
            if (skCardIdx !== -1 && pdfFile) row[skCardIdx] = pdfFile.webViewLink;
            skAppends.push(row);
        }

        // Sleep to avoid rate limits
        await sleep(15000); 
    }

    if (updates.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: { valueInputOption: 'USER_ENTERED', data: updates }
        });
        console.log(`Updated ${updates.length} cells.`);
    }

    if (clAppends.length > 0) {
        await sheets.spreadsheets.values.append({ spreadsheetId: SPREADSHEET_ID, range: 'CHECKLIST!A:Z', valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS', requestBody: { values: clAppends } });
        console.log(`Appended ${clAppends.length} rows to CHECKLIST.`);
    }
    if (asAppends.length > 0) {
        await sheets.spreadsheets.values.append({ spreadsheetId: SPREADSHEET_ID, range: 'NSL-ASSESS!A:Z', valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS', requestBody: { values: asAppends } });
        console.log(`Appended ${asAppends.length} rows to NSL-ASSESS.`);
    }
    if (skAppends.length > 0) {
        await sheets.spreadsheets.values.append({ spreadsheetId: SPREADSHEET_ID, range: 'NSL-SKILL!A:Z', valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS', requestBody: { values: skAppends } });
        console.log(`Appended ${skAppends.length} rows to NSL-SKILL.`);
    }

    console.log('ALL DONE!');
}
run();
