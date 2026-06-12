const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');
const pdf = require('pdf-parse');

const FOLDER_ID = '1ueYDRIYkxicq_6QKG0-oB05trbmprpOd'; // Folder for Phuong Nguyen

async function run() {
    const drive = google.drive({ version: 'v3', auth: serviceAccountClient });
    try {
        console.log('Listing files in folder...');
        const filesRes = await drive.files.list({
            q: `'${FOLDER_ID}' in parents`,
            fields: 'files(id, name, mimeType)'
        });
        
        console.log('Files inside folder:', filesRes.data.files);
        
        const pdfFile = filesRes.data.files.find(f => f.mimeType === 'application/pdf');
        if (!pdfFile) {
            console.log('No PDF file found!');
            return;
        }

        console.log(`Downloading PDF: ${pdfFile.name} (${pdfFile.id})...`);
        const pdfDataRes = await drive.files.get({ fileId: pdfFile.id, alt: 'media' }, { responseType: 'arraybuffer' });
        
        console.log('Parsing PDF...');
        const pdfText = (await pdf(Buffer.from(pdfDataRes.data))).text;
        
        console.log('\n--- PDF Text Content ---');
        console.log(pdfText.substring(0, 3000)); // Print first 3000 characters
        console.log('--- End of PDF ---');
    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
