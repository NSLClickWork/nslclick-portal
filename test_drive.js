const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

async function testDrive() {
    const drive = google.drive({ version: 'v3', auth: serviceAccountClient });
    try {
        const res = await drive.files.list({
            q: "'1bjsmFAXZ-B5Kq1Lpc0gIt0A-9LYNXbjB' in parents",
            fields: 'files(id, name, mimeType, webViewLink)'
        });
        console.log('Files:', res.data.files);
    } catch (e) {
        console.error('Error:', e.message);
    }
}
testDrive();
