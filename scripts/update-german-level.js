const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { google } = require('googleapis');
const { serviceAccountClient } = require('../services/googleAuth');

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

async function extractGermanLevel(imagePath) {
    const imageBase64 = fs.readFileSync(imagePath, { encoding: 'base64' });
    const payload = {
        model: 'google/gemma-3n-e4b-it',
        messages: [{
            role: 'user',
            content: [
                { type: 'text', text: 'Extract the candidate name and German B1 status (under Deutsch B1 or similar) from this setcard image. Return ONLY a valid JSON object like {"name": "candidate name", "german_level": "status text"}. Do not return any markdown or other text.' },
                { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + imageBase64 } }
            ]
        }],
        max_tokens: 128,
        temperature: 0.2
    };

    try {
        const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer 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',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        const text = data.choices[0].message.content;
        const jsonStr = text.match(/\{[\s\S]*\}/)[0];
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error('Error parsing response for', imagePath);
        return null;
    }
}

function normalizeWords(str) {
    if (!str) return [];
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, ' ').split(/\s+/).filter(w=>w);
}

async function updateSheet() {
    console.log('Connecting to Google Sheets...');
    const sheets = google.sheets({ version: 'v4', auth: serviceAccountClient });
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'NSL-ASSESS!B:I'
    });
    
    const rows = response.data.values;
    
    const folderPath = path.join(__dirname, '../NSL_Candidate_Setcards');
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
    
    console.log(`Found ${files.length} images.`);
    
    let updates = [];
    
    // Process sequentially to avoid rate limits
    for (const file of files) {
        console.log(`Processing ${file}...`);
        const extracted = await extractGermanLevel(path.join(folderPath, file));
        if (!extracted || !extracted.name) {
            console.log(`Failed to extract data from ${file}`);
            continue;
        }
        
        console.log(`Extracted: ${extracted.name} -> ${extracted.german_level}`);
        
        const nameWords = normalizeWords(extracted.name);
        
        let rowIndex = -1;
        for (let i = 0; i < rows.length; i++) {
            if (!rows[i] || rows[i].length < 2) continue;
            // Name is at index 1 of the fetched range
            const sheetNameWords = normalizeWords(rows[i][1]);
            if (sheetNameWords.length > 0 && nameWords.every(w => sheetNameWords.includes(w))) {
                rowIndex = i;
                break;
            }
        }
        
        if (rowIndex !== -1) {
            const currentLevel = rows[rowIndex][7]; // index 7 is column I
            if (!currentLevel || currentLevel.trim() === '') {
                updates.push({
                    range: `NSL-ASSESS!I${rowIndex + 1}`,
                    values: [[extracted.german_level]]
                });
                console.log(`Queue update: Row ${rowIndex + 1} with ${extracted.german_level}`);
            } else {
                console.log(`Row ${rowIndex + 1} already has value: ${currentLevel}`);
            }
        } else {
            console.log(`Could not find candidate ${extracted.name} in sheet.`);
        }
    }
    
    if (updates.length > 0) {
        console.log(`Applying ${updates.length} updates to Google Sheets...`);
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                valueInputOption: 'USER_ENTERED',
                data: updates
            }
        });
        console.log('Update completed successfully!');
    } else {
        console.log('No updates needed.');
    }
}

updateSheet().catch(console.error);
