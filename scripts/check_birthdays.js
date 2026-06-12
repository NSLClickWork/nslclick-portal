const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';

async function run() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });
    try {
        // Fetch NSL-SKILL rows
        const resSkill = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'NSL-SKILL!A6:CG25'
        });
        const rowsSkill = resSkill.data.values;
        if (rowsSkill && rowsSkill.length > 0) {
            const headers = rowsSkill[0];
            const studentIdIdx = headers.indexOf('STUDENT ID');
            const studentNameIdx = headers.indexOf('STUDENT NAME');
            const birthdayIdx = headers.indexOf('BIRTHDAY');
            const ageIdx = headers.indexOf('AGE');
            const b1StatusIdx = headers.indexOf('B1 STATUS');
            const superpowersDeIdx = headers.indexOf('SUPERPOWERS (DE)');
            const superpowersEnIdx = headers.indexOf('SUPERPOWERS (EN)');
            
            console.log('=== NSL-SKILL Sample Data ===');
            rowsSkill.slice(1, 10).forEach((r) => {
                console.log({
                    id: r[studentIdIdx] || '',
                    name: r[studentNameIdx] || '',
                    birthday: r[birthdayIdx] || '',
                    age: r[ageIdx] || '',
                    b1Status: r[b1StatusIdx] || '',
                    superpowersDe: r[superpowersDeIdx] || '',
                    superpowersEn: r[superpowersEnIdx] || ''
                });
            });
        }

        // Fetch CHECKLIST rows
        const resCheck = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'CHECKLIST!A3:BH15'
        });
        const rowsCheck = resCheck.data.values;
        if (rowsCheck && rowsCheck.length > 0) {
            const headers = rowsCheck[0];
            const studentIdIdx = headers.indexOf('Student ID');
            const studentNameIdx = headers.indexOf('Student Name');
            const b1CertIdx = headers.indexOf('B1 Certificate');
            const sp1Idx = headers.indexOf('Superpower 1');
            const sp2Idx = headers.indexOf('Superpower 2');
            const sp3Idx = headers.indexOf('Superpower 3');
            const availIdx = headers.indexOf('Availability');
            
            console.log('\n=== CHECKLIST Sample Data ===');
            rowsCheck.slice(1, 10).forEach((r) => {
                console.log({
                    id: r[studentIdIdx] || '',
                    name: r[studentNameIdx] || '',
                    b1Cert: r[b1CertIdx] || '',
                    sp1: r[sp1Idx] || '',
                    sp2: r[sp2Idx] || '',
                    sp3: r[sp3Idx] || '',
                    avail: r[availIdx] || ''
                });
            });
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
