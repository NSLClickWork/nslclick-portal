const fs = require('fs');
const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');
require('dotenv').config();

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';

function getGradeFromScore(score) {
    const s = parseInt(score) || 0;
    if (s >= 85) return 'A';
    if (s >= 75) return 'B';
    if (s >= 65) return 'C';
    if (s >= 55) return 'D';
    return 'E';
}

function getShortName(fullName) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
        const ho = parts[0].toUpperCase();
        const ten = parts[parts.length - 1];
        return ten.charAt(0).toUpperCase() + ten.slice(1).toLowerCase() + ' ' + ho;
    }
    return fullName;
}

// These are EXACTLY the rows that were deleted, reconstructed from the data we had
// CHECKLIST rows (with fake IDs from before the cleanup)
const candidatesToRestore = [
    // From extracted_candidates.json
    {
        id: 'HDEU_PHUONG_NGUYEN_1995', name: 'Phuong NGUYEN', center: 'HDEU',
        score: 66, birthYear: '1995', avail: '06/2026', profession: 'Verkäufer',
        s1: 'Proaktiver Problemlöser', s2: 'Freundlicher Kundenberater', s3: 'Aufmerksamer Zuhörer',
        level: 'B1',
        photoLink: 'https://drive.google.com/file/d/117PRSFvlWyYCDa4tNwxpzOXeAWoSeo5V/view?usp=drivesdk',
        videoLink: 'https://drive.google.com/file/d/1VgemGt5qEBD28-YZHFm96WQ4uZRRFz2z/view?usp=drivesdk',
        pdfLink: 'https://drive.google.com/file/d/1b2uo837BTKH6nO61vS8c6bUeMtxr22sS/view?usp=drivesdk'
    },
    {
        id: 'EI_QUYNH_TRAN_1998', name: 'Quynh TRAN', center: 'EI',
        score: 55, birthYear: '1998', avail: '06/2026', profession: 'Verkäufer',
        s1: 'Erfahrung im Kundenservice', s2: 'Verantwortungsbewusste', s3: 'Anpassungsfähiger Lerner',
        level: 'B1',
        photoLink: 'https://drive.google.com/file/d/14PdUQgkEk7lBoy6UnhIWAE727G__QFml/view?usp=drivesdk',
        videoLink: 'https://drive.google.com/file/d/1ZDatZSFkU-m69v5d2PPW7qfSR7jdRF99/view?usp=drivesdk',
        pdfLink: 'https://drive.google.com/file/d/1yddWatQaygAl9neGxmIR9E9AkDFKd1fe/view?usp=drivesdk'
    },
    {
        id: 'ANG_PHU_NGUYEN_2006', name: 'Phu NGUYEN', center: 'ANG',
        score: 80, birthYear: '2006', avail: '09/2026', profession: 'Verkäufer',
        s1: 'Verantwortungsbewusster Arbeiter', s2: 'Serviceorientierter Verkäufer', s3: 'Zuverlässiger Teamplayer',
        level: 'B1',
        photoLink: 'https://drive.google.com/file/d/1eRgp8dvVyn_k8ZatRBQK-_HXcX-BDAQS/view?usp=drivesdk',
        videoLink: 'https://drive.google.com/file/d/1Q3FEK19lm-ASsGl4x741ykBNDu50MFiH/view?usp=drivesdk',
        pdfLink: 'https://drive.google.com/file/d/1W-qdLgr3CdlZfWmTQGYrGlorLXN4QCja/view?usp=drivesdk'
    },
    {
        id: 'ANG_LONG_DOAN_2006', name: 'Long DOAN', center: 'ANG',
        score: 77, birthYear: '2006', avail: '09/2026', profession: 'Verkäufer',
        s1: 'Zuverlässiger Teamplayer', s2: 'Freundlicher Kundenberater', s3: 'Flexibler Unterstützer',
        level: 'B1',
        photoLink: 'https://drive.google.com/file/d/1f6RXoD9AABFHDfVGsFrv_U5v9ZlvidME/view?usp=drivesdk',
        videoLink: 'https://drive.google.com/file/d/1Sl6cMbGVBtbRhJsg0BcPH7s6SMOrQkXo/view?usp=drivesdk',
        pdfLink: 'https://drive.google.com/file/d/1VE259mijrNcfksg23rNdihg4aMCaZyGZ/view?usp=drivesdk',
        checklistOnly: false, assessOnly: true  // Long DOAN already exists in CHECKLIST with proper ID
    },
    {
        id: 'ANG_DUONG_BINH_2005', name: 'Binh Duong', center: 'ANG',
        score: 61, birthYear: '2005', avail: '09/2026', profession: 'Verkäufer',
        s1: 'Zuverlässiger Teamplayer', s2: 'Verantwortungsbewusster Arbeiter', s3: 'Flexibler',
        level: 'B1',
        photoLink: 'https://drive.google.com/file/d/1El0Edpw4R9fI5S8zIExdWFvBoZHDPAU7/view?usp=drivesdk',
        videoLink: 'https://drive.google.com/file/d/1UEyfZN4SWAJjG_jLzT9zpQQjqoIBwrn0/view?usp=drivesdk',
        pdfLink: 'https://drive.google.com/file/d/1EIC2oHuZctgGA7mJ5QKTIGXQ0gPbHlfn/view?usp=drivesdk'
    },
    {
        id: 'ANG_HOANG_TRAN_2005', name: 'Hoang TRAN', center: 'ANG',
        score: 65, birthYear: '2005', avail: '09/2026', profession: 'Verkäufer',
        s1: 'Anpassungsfähiger lerner', s2: 'Zuverlässiger Teamplayer', s3: 'Flexibler Unterstützer',
        level: 'B1',
        photoLink: 'https://drive.google.com/file/d/15KZyufde-fzY9Cv79Gd_R66rEoIKsihO/view?usp=drivesdk',
        videoLink: 'https://drive.google.com/file/d/1VdCU_ct-TF2BD7TEvN07-R4EWheKBqzh/view?usp=drivesdk',
        pdfLink: 'https://drive.google.com/file/d/1WUXCoIRpqtCgqj43t30AEd0Y_r__obrA/view?usp=drivesdk'
    },
    {
        id: 'ANG_THAI_THAN_2002', name: 'Thai THAN', center: 'ANG',
        score: 69, birthYear: '2002', avail: '09/2026', profession: 'Verkäufer',
        s1: 'Verantwortungsbewusster Arbeiter', s2: 'Freundlicher Kundenberater', s3: 'Flexibler Unterstützer',
        level: 'B1',
        photoLink: 'https://drive.google.com/file/d/1ovqcw9YXVtRm1M7HgMxO287z89Y0Gmw6/view?usp=drivesdk',
        videoLink: 'https://drive.google.com/file/d/1NW22Og9iELYfJSI5HmPVZVaor1XNn69B/view?usp=drivesdk',
        pdfLink: 'https://drive.google.com/file/d/1e-vOHRBGvS4YzFQr_-33Wrl7jiAs6qVy/view?usp=drivesdk'
    },
    {
        id: 'ANG_THAI_NGO_2006', name: 'Thai NGO', center: 'ANG',
        score: 62, birthYear: '2006', avail: '09/2026', profession: 'Verkäufer',
        s1: 'Motivierter Kommunikator', s2: 'Anpassungsfähiger Lerner', s3: 'Zuverlässiger Teamplayer',
        level: 'B1',
        photoLink: 'https://drive.google.com/file/d/1L3fllcmKHpgzc5QC3XQYKWNv3QJsz8Oa/view?usp=drivesdk',
        videoLink: 'https://drive.google.com/file/d/1E5__Vmi9SfJ2943p9J0qVLB1DZoT-aau/view?usp=drivesdk',
        pdfLink: 'https://drive.google.com/file/d/1AUB8L7lfa0r4f0FPo2xQLT6rSQwHkNsf/view?usp=drivesdk'
    },
    {
        id: 'ANG_THI_NGUYEN_2006', name: 'Thi NGUYEN', center: 'ANG',
        score: 53, birthYear: '2006', avail: '09/2026', profession: 'Verkäufer',
        s1: 'Freundlichkeit und Kundenkontakt', s2: 'Sorgfalt und Hygiene', s3: 'Zuverlässigkeit',
        level: 'B1',
        photoLink: 'https://drive.google.com/file/d/1jC7fO6ggaXS1WRw4k4ZxrlpoQ1url336/view?usp=drivesdk',
        videoLink: 'https://drive.google.com/file/d/1K54zqePP-xpfnjM9T1a1B-ZgE4YIEnZL/view?usp=drivesdk',
        pdfLink: 'https://drive.google.com/file/d/141ui4HaINdLqLGVVOMsSqfwZ1fOKrshi/view?usp=drivesdk'
    },
    {
        id: 'ANG_HUYEN_PHAM_2005', name: 'Huyen PHAM', center: 'ANG',
        score: 81, birthYear: '2005', avail: '09/2026', profession: 'Verkäufer',
        s1: 'Sorgfältiger Arbeiter', s2: 'Aufmerksamer Zuhörer', s3: 'Fleißiger Mitarbeiter',
        level: 'B1',
        photoLink: 'https://drive.google.com/file/d/1T57Ya75penGGfdJ96kpRcd-s8tIwRM8E/view?usp=drivesdk',
        videoLink: 'https://drive.google.com/file/d/1pmc8hbbg7BDqm_nlPdp4sHrrcLtuoh1K/view?usp=drivesdk',
        pdfLink: 'https://drive.google.com/file/d/1WXtO0BjLdWIhzK-r2VNxMjKQm8D1S9qU/view?usp=drivesdk'
    },
    {
        id: 'ANG_TRANG_BUI_2005', name: 'Trang BUI', center: 'ANG',
        score: 67, birthYear: '2005', avail: '09/2026', profession: 'Verkäufer',
        s1: 'Zuverlässiger Teamplayer', s2: 'Engagierter Mitarbeiter', s3: 'Anpassungsfähiger Lerner',
        level: 'B1',
        photoLink: 'https://drive.google.com/file/d/1108kFseIiRYcmLkjSVzv9Hm8fjd2dqQk/view?usp=drivesdk',
        videoLink: 'https://drive.google.com/file/d/11Ni2IFvXsz3ohm2TK3kL9_sbqeE7T_od/view?usp=drivesdk',
        pdfLink: 'https://drive.google.com/file/d/1fJifQAr5sd-PJrFmHLZVovUQW7tMLeQv/view?usp=drivesdk'
    },
    {
        id: 'ANG_NHI_PHAM_2005', name: 'Nhi PHAM', center: 'ANG',
        score: 51, birthYear: '2005', avail: '09/2026', profession: 'Verkäufer',
        s1: 'Motivierter Kommunikator', s2: 'Zuverlässiger Teamplayer', s3: 'Freundlicher Verkäufer',
        level: 'B1',
        photoLink: 'https://drive.google.com/file/d/14OdSryYQiZfDqOWbOqLyzlH_kMiguqjy/view?usp=drivesdk',
        videoLink: 'https://drive.google.com/file/d/1_UBGbIYCLmcJNXovJrkoc2qJRUOXrK3I/view?usp=drivesdk',
        pdfLink: 'https://drive.google.com/file/d/1_arFFQiW_3ZzO0En7zYHwOgZpgh5WyY8/view?usp=drivesdk'
    },
    // These 2 were in the sheet but not in extracted_candidates.json - restore with minimal data
    {
        id: 'ANG_Quyen_TRINH_2006', name: 'Quyen TRINH', center: 'ANG',
        score: '', birthYear: '2006', avail: '', profession: 'Verkäufer',
        s1: '', s2: '', s3: '',
        level: 'B1',
        photoLink: '', videoLink: '', pdfLink: ''
    },
    {
        id: 'ANG_Anh_NGUYEN_2006', name: 'Anh NGUYEN', center: 'ANG',
        score: '', birthYear: '2006', avail: '', profession: 'Verkäufer',
        s1: '', s2: '', s3: '',
        level: 'B1',
        photoLink: '', videoLink: '', pdfLink: ''
    }
];

async function run() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });

    try {
        // Get current row counts FIRST — only append, never overwrite
        const clRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'CHECKLIST!A1:B600' });
        const clRows = clRes.data.values || [];
        const clLastRow = clRows.length; // 1-indexed: next row = clLastRow + 1

        const asRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'NSL-ASSESS!A1:B600' });
        const asRows = asRes.data.values || [];
        const asLastRow = asRows.length;

        const skRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'NSL-SKILL!A1:B600' });
        const skRows = skRes.data.values || [];
        const skLastRow = skRows.length;

        const hdRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'HDEU!A1:B20' });
        const hdRows = hdRes.data.values || [];
        const hdLastRow = hdRows.length;

        console.log(`Current last rows: CL=${clLastRow}, AS=${asLastRow}, SK=${skLastRow}, HD=${hdLastRow}`);

        // Check which IDs already exist to avoid double-adding
        const existingIds = new Set(clRows.map(r => r[1]).filter(Boolean).map(id => id.toUpperCase()));
        const existingAsIds = new Set(asRows.map(r => r[1]).filter(Boolean).map(id => id.toUpperCase()));
        const existingSkIds = new Set(skRows.map(r => r[1]).filter(Boolean).map(id => id.toUpperCase()));

        const clAppends = [];
        const asAppends = [];
        const skAppends = [];
        const hdAppends = [];

        let nextNo = clLastRow - 2; // subtract header rows (2 header rows + 1 for 0-index)

        for (const c of candidatesToRestore) {
            const idUpper = c.id.toUpperCase();
            const shortName = getShortName(c.name);
            const grade = c.score ? getGradeFromScore(c.score) : '';

            // CHECKLIST - skip assessOnly candidates and existing ones
            if (!c.assessOnly && !existingIds.has(idUpper)) {
                const clRow = new Array(60).fill('');
                clRow[0] = String(++nextNo);
                clRow[1] = c.id;
                clRow[2] = c.name;
                clRow[3] = shortName;
                clRow[4] = c.center;
                clRow[6] = 'TRUE';
                clRow[7] = 'TRUE';
                clRow[17] = 'FALSE';
                clRow[27] = c.pdfLink;
                clRow[52] = c.s1;
                clRow[53] = c.s2;
                clRow[54] = c.s3;
                clRow[55] = c.avail;
                clRow[56] = c.photoLink;
                clRow[58] = c.videoLink;
                clAppends.push(clRow);
                existingIds.add(idUpper);
                console.log(`[CHECKLIST] Will restore: ${c.name} (${c.id})`);
            } else if (existingIds.has(idUpper)) {
                console.log(`[CHECKLIST] Already exists, skipping: ${c.name}`);
            }

            // NSL-ASSESS
            if (!existingAsIds.has(idUpper)) {
                const asRow = new Array(25).fill('');
                asRow[1] = c.id;
                asRow[2] = c.name;
                asRow[3] = 'LANGUAGE SCHOOL';
                asRow[4] = c.profession || '';
                asRow[6] = c.center;
                asRow[8] = c.level || 'B1';
                asRow[16] = c.score ? String(c.score) : '';
                asRow[17] = grade;
                asAppends.push(asRow);
                existingAsIds.add(idUpper);
                console.log(`[NSL-ASSESS] Will restore: ${c.name}`);
            }

            // NSL-SKILL
            if (!existingSkIds.has(idUpper)) {
                const skRow = new Array(85).fill('');
                skRow[1] = c.id;
                skRow[2] = c.name;
                skRow[3] = c.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
                skRow[9] = shortName;
                skRow[10] = 'SKILL CENTRE';
                skRow[13] = c.profession || '';
                skRow[18] = c.videoLink;
                skRow[21] = c.center;
                skRow[25] = `01/01/${c.birthYear}`;
                skRow[26] = String(2026 - parseInt(c.birthYear));
                skRow[31] = c.level || 'B1';
                skRow[54] = c.score ? String(c.score) : '';
                skRow[55] = grade;
                skRow[63] = [c.s1, c.s2, c.s3].filter(Boolean).join(', ');
                skRow[67] = c.photoLink;
                skRow[79] = c.pdfLink;
                skRow[80] = c.videoLink;
                skAppends.push(skRow);
                existingSkIds.add(idUpper);
                console.log(`[NSL-SKILL] Will restore: ${c.name}`);
            }

            // HDEU sheet — only HDEU candidates
            if (c.center === 'HDEU') {
                const existingHdNames = new Set(hdRows.map(r => r[1]).filter(Boolean).map(n => n.toLowerCase()));
                if (!existingHdNames.has(c.name.toLowerCase())) {
                    const hdRow = new Array(15).fill('');
                    hdRow[0] = String(hdLastRow - 2 + hdAppends.length + 1);
                    hdRow[1] = c.name;
                    hdRow[2] = shortName;
                    hdRow[3] = 'TRUE';
                    hdRow[9] = 'TRUE';
                    hdRow[10] = c.level || 'B1';
                    hdAppends.push(hdRow);
                    console.log(`[HDEU] Will restore: ${c.name}`);
                }
            }
        }

        // Write using update at specific row — safer than append
        if (clAppends.length > 0) {
            const startRow = clLastRow + 1;
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `CHECKLIST!A${startRow}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: clAppends }
            });
            console.log(`✓ Restored ${clAppends.length} rows to CHECKLIST starting at row ${startRow}`);
        }

        if (asAppends.length > 0) {
            const startRow = asLastRow + 1;
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `NSL-ASSESS!A${startRow}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: asAppends }
            });
            console.log(`✓ Restored ${asAppends.length} rows to NSL-ASSESS starting at row ${startRow}`);
        }

        if (skAppends.length > 0) {
            const startRow = skLastRow + 1;
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `NSL-SKILL!A${startRow}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: skAppends }
            });
            console.log(`✓ Restored ${skAppends.length} rows to NSL-SKILL starting at row ${startRow}`);
        }

        if (hdAppends.length > 0) {
            const startRow = hdLastRow + 1;
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `HDEU!A${startRow}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: hdAppends }
            });
            console.log(`✓ Restored ${hdAppends.length} rows to HDEU starting at row ${startRow}`);
        }

        console.log('\nDONE. Data restored. Did NOT touch any existing rows.');

    } catch (err) {
        console.error('Error:', err.message);
    }
}

run();
