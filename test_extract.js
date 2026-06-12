const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: { responseMimeType: "application/json" } });

async function run() {
    const drive = google.drive({ version: 'v3', auth: serviceAccountClient });
    
    // Download one PDF: 1b2uo837BTKH6nO61vS8c6bUeMtxr22sS
    const res = await drive.files.get({ fileId: '1b2uo837BTKH6nO61vS8c6bUeMtxr22sS', alt: 'media' }, { responseType: 'arraybuffer' });
    const base64Data = Buffer.from(res.data).toString('base64');
    
    const prompt = `Extract the candidate's information into a JSON object with the following exact keys:
- "Tên": String. Candidate full name.
- "Nghề": String. Candidate profession (e.g. Pflege, Koch, etc.).
- "Điểm_NSL": String. NSL Score (a number).
- "Rank": String. NSL Grade (A, B, C, S, etc.).
- "Superpower_1": String. German word.
- "Superpower_2": String. German word.
- "Superpower_3": String. German word.
- "Bằng": String. German level. If not found, output "B1".
- "Hạn_bằng": String. Availability date in MM/YYYY.
Ensure output is strictly valid JSON.`;

    try {
        const result = await model.generateContent([
            { inlineData: { data: base64Data, mimeType: "application/pdf" } },
            prompt
        ]);
        console.log(result.response.text());
    } catch (e) {
        console.error('Failed with inlineData:', e.message);
    }
}
run();
