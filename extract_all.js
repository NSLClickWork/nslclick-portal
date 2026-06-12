const fs = require('fs');
const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');
const pdf = require('pdf-parse');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const ROOT_FOLDER_ID = '1bjsmFAXZ-B5Kq1Lpc0gIt0A-9LYNXbjB';
const JSON_FILE = 'extracted_candidates.json';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-flash-latest", 
    generationConfig: { responseMimeType: "application/json" } 
});

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGemini(text) {
    const prompt = `Extract candidate information from the profile text into a valid JSON object.
Requirements:
{
  "Name": "Full name",
  "Profession": "Profession like Pflege, Koch, Hotelfachmann, Restaurantfachmann, etc.",
  "Score": "NSL Score (number)",
  "Grade": "NSL Grade (A/B/C/S/etc.)",
  "S1": "Superpower 1 (German strength)",
  "S2": "Superpower 2 (German strength)",
  "S3": "Superpower 3 (German strength)",
  "Level": "German level (e.g. B1, B2 - default to B1 if not specified or B1 is mentioned)",
  "BirthYear": "Birth year (Geburtsjahr, e.g. 1998, 2003, etc.)",
  "Avail": "Availability date (Verfügbarkeit, e.g. 06/2026, MM/YYYY)"
}

Text:
${text}

Return strictly valid JSON only.`;

    let attempts = 0;
    while (attempts < 5) {
        try {
            const result = await model.generateContent(prompt);
            const textRes = result.response.text();
            return JSON.parse(textRes);
        } catch (e) {
            console.log(`Gemini Attempt ${attempts + 1} failed: ${e.message}. Retrying in 15s...`);
            await sleep(15000);
            attempts++;
        }
    }
    return null;
}

async function run() {
    const drive = google.drive({ version: 'v3', auth: serviceAccountClient });
    
    // Load existing extracted data
    let extractedData = [];
    if (fs.existsSync(JSON_FILE)) {
        try {
            extractedData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
            console.log(`Loaded ${extractedData.length} existing extracted candidates.`);
        } catch (err) {
            console.error('Error loading existing JSON:', err.message);
        }
    }

    try {
        console.log('Listing folders in Drive...');
        const foldersRes = await drive.files.list({
            q: `'${ROOT_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder'`,
            fields: 'files(id, name)'
        });
        const folders = foldersRes.data.files;
        console.log(`Found ${folders.length} folders in total.`);

        // Process all folders starting with a number
        const targetFolders = folders.filter(f => {
            const match = f.name.match(/^\d+\./);
            return match !== null;
        }).sort((a, b) => {
            // Sort numerically
            const aNum = parseInt(a.name.match(/^(\d+)\./)[1]);
            const bNum = parseInt(b.name.match(/^(\d+)\./)[1]);
            return aNum - bNum;
        });

        console.log('Sorted folders starting with a number:', targetFolders.map(f => f.name));

        // Filter out those already extracted
        const foldersToProcess = targetFolders.filter(f => {
            return !extractedData.some(e => e.folderName === f.name);
        });

        console.log('Folders remaining to process:', foldersToProcess.map(f => f.name));

        if (foldersToProcess.length === 0) {
            console.log('All folders have already been extracted.');
            return;
        }

        for (const folder of foldersToProcess) {
            console.log(`\n--- Processing ${folder.name} ---`);
            const filesRes = await drive.files.list({
                q: `'${folder.id}' in parents`,
                fields: 'files(id, name, mimeType, webViewLink)'
            });
            const files = filesRes.data.files;
            
            const pdfFile = files.find(f => f.mimeType === 'application/pdf');
            const imgFile = files.find(f => f.mimeType.startsWith('image/'));
            const vidFile = files.find(f => f.mimeType.startsWith('video/'));

            console.log(`PDF: ${pdfFile ? pdfFile.name : 'Missing'}`);
            console.log(`Image: ${imgFile ? imgFile.name : 'Missing'}`);
            console.log(`Video: ${vidFile ? vidFile.name : 'Missing'}`);

            if (!pdfFile) {
                console.log(`No PDF file found for candidate ${folder.name}. Skipping.`);
                continue;
            }

            console.log(`Downloading PDF ${pdfFile.name}...`);
            const pdfDataRes = await drive.files.get({ fileId: pdfFile.id, alt: 'media' }, { responseType: 'arraybuffer' });
            const pdfText = (await pdf(Buffer.from(pdfDataRes.data))).text;

            console.log('Extracting details using Gemini...');
            const extracted = await callGemini(pdfText);
            if (extracted) {
                extracted.folderName = folder.name;
                extracted.photoLink = imgFile ? imgFile.webViewLink : '';
                extracted.videoLink = vidFile ? vidFile.webViewLink : '';
                extracted.pdfLink = pdfFile.webViewLink;
                console.log('Extracted Details:', extracted);
                extractedData.push(extracted);
                
                // Write progress to file after each candidate in case of cancellation/crash
                fs.writeFileSync(JSON_FILE, JSON.stringify(extractedData, null, 4), 'utf8');
            } else {
                console.log(`Failed to extract details for ${folder.name}`);
            }

            // Sleep between candidates to respect the RPM limits
            await sleep(8000);
        }

        console.log('\nAll candidate folders processed.');

    } catch (e) {
        console.error('Error:', e);
    }
}

run();
