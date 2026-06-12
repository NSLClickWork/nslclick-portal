const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';
const FOLDER_ID = '1bjsmFAXZ-B5Kq1Lpc0gIt0A-9LYNXbjB';

async function fillSheet() {
    const drive = google.drive({ version: 'v3', auth: serviceAccountClient });
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });

    try {
        console.log('Fetching folders from Drive...');
        const res = await drive.files.list({
            q: `'${FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder'`,
            fields: 'files(id, name, webViewLink)',
            pageSize: 100
        });

        const folders = res.data.files;
        if (!folders || folders.length === 0) {
            console.log('No folders found.');
            return;
        }

        const candidates = [];

        // Skip "NSL ANNA - Reduced Video" folder
        for (const folder of folders) {
            if (folder.name.includes('NSL ANNA')) continue;

            console.log(`Processing folder: ${folder.name}`);

            // Parse name: e.g. "01. PHUONG NGUYEN (Team 1, HDEU)"
            // Remove the leading "XX. "
            let cleanName = folder.name.replace(/^\d+\.\s*/, '').trim();
            let centerCode = 'ANG';
            
            if (cleanName.includes('Team')) {
                centerCode = 'HDEU';
            }

            // Extract short name (everything before the parenthesis)
            let shortName = cleanName;
            const parenIndex = cleanName.indexOf('(');
            if (parenIndex !== -1) {
                shortName = cleanName.substring(0, parenIndex).trim();
            }

            const studentId = `${centerCode}_${shortName.replace(/\s+/g, '_')}_01.01.2000`;

            // List files inside the folder
            const filesRes = await drive.files.list({
                q: `'${folder.id}' in parents`,
                fields: 'files(id, name, mimeType, webViewLink)'
            });

            let photoLink = '';
            let videoLink = '';

            for (const file of filesRes.data.files) {
                if (file.mimeType.startsWith('image/')) {
                    photoLink = file.webViewLink;
                } else if (file.mimeType.startsWith('video/')) {
                    videoLink = file.webViewLink;
                }
            }

            candidates.push({
                studentId,
                shortName,
                photoLink,
                videoLink
            });
        }

        console.log(`Prepared ${candidates.length} candidates. Fetching sheet headers...`);

        // Fetch sheet to find column indices
        const sheetData = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'CHECKLIST!A:ZZ'
        });

        const rows = sheetData.data.values;
        if (!rows || rows.length === 0) {
            console.error('Sheet is empty or not found');
            return;
        }

        let headerRowIndex = rows.findIndex(row => row.some(c => c && c.trim().toLowerCase().replace(/\s/g, '') === 'studentid'));
        if (headerRowIndex === -1) headerRowIndex = 0;

        const headers = rows[headerRowIndex].map(h => h ? h.trim().toLowerCase() : '');
        
        const idCol = headers.findIndex(h => h.replace(/\s/g, '') === 'studentid');
        const nameCol = headers.findIndex(h => h === 'student name' || h === 'fullname');
        const photoCol = headers.findIndex(h => h === 'photo' || h === 'photo link');
        const videoCol = headers.findIndex(h => h === 'introduction video' || h === 'youtube link');

        console.log(`Columns -> ID: ${idCol}, Name: ${nameCol}, Photo: ${photoCol}, Video: ${videoCol}`);

        // Prepare append rows
        const appendData = [];
        for (const candidate of candidates) {
            // Create an empty row
            const newRow = new Array(headers.length).fill('');
            if (idCol !== -1) newRow[idCol] = candidate.studentId;
            if (nameCol !== -1) newRow[nameCol] = candidate.shortName;
            if (photoCol !== -1) newRow[photoCol] = candidate.photoLink;
            if (videoCol !== -1) newRow[videoCol] = candidate.videoLink;
            
            appendData.push(newRow);
        }

        console.log('Appending data to sheet...');
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'CHECKLIST!A:A',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: appendData
            }
        });

        console.log('Successfully appended all candidates to the sheet!');

    } catch (e) {
        console.error('Error:', e.message);
    }
}

fillSheet();
