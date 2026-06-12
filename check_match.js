const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');
const fs = require('fs');

const SPREADSHEET_ID = '1mMfpTipZ8w9LpnebDlc1qC7pkNoX3NafhGXdUeJjyH4';

function normalize(str) {
    if (!str) return '';
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
}

async function run() {
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });
    try {
        const asRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'NSL-ASSESS!A1:Z200' });
        const asRows = asRes.data.values || [];

        const skRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'NSL-SKILL!A1:Z200' });
        const skRows = skRes.data.values || [];

        const clRes = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'CHECKLIST!A1:Z200' });
        const clRows = clRes.data.values || [];

        const candidates = JSON.parse(fs.readFileSync('extracted_candidates.json', 'utf8'));

        console.log('Mapping candidates to EXISTING row indexes...');

        const updates = { AS: [], SK: [] };
        const notFound = [];

        candidates.forEach(c => {
            const parts = normalize(c.Name).split(' ');
            const foundClRow = clRows.findIndex(r => {
                if (!r[1] || r.length < 3) return false;
                const sheetName = normalize(r[2]);
                const isOriginal = (r[1].match(/\./g) || []).length === 2; 
                return isOriginal && parts.every(p => sheetName.includes(p));
            });

            if (foundClRow !== -1) {
                const id = clRows[foundClRow][1];
                // Find in ASSESS
                const asRowIdx = asRows.findIndex(r => r[1] === id);
                // Find in SKILL
                const skRowIdx = skRows.findIndex(r => r[1] === id);

                console.log(`Matched ${c.Name} -> ID: ${id} | CL: ${foundClRow+1}, AS: ${asRowIdx !== -1 ? asRowIdx+1 : 'NO'}, SK: ${skRowIdx !== -1 ? skRowIdx+1 : 'NO'}`);
            } else {
                // Try finding directly in SKILL using short name logic if needed
                const skRowIdx = skRows.findIndex(r => {
                    if (!r[1] || r.length < 3) return false;
                    const sheetName = normalize(r[2]);
                    const isOriginal = (r[1].match(/\./g) || []).length === 2; 
                    return isOriginal && parts.every(p => sheetName.includes(p));
                });
                if (skRowIdx !== -1) {
                     console.log(`Matched ${c.Name} only in SKILL -> ID: ${skRows[skRowIdx][1]}`);
                } else {
                     notFound.push(c.Name);
                }
            }
        });

        console.log('\nNot Found Candidates:', notFound);
    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
