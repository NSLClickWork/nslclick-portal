const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

async function run() {
    const drive = google.drive({ version: 'v3', auth: serviceAccountClient });
    const res = await drive.files.list({
        q: "'1bjsmFAXZ-B5Kq1Lpc0gIt0A-9LYNXbjB' in parents",
        fields: 'files(id, name, mimeType, webViewLink)'
    });
    console.log(JSON.stringify(res.data.files, null, 2));
}
run();
