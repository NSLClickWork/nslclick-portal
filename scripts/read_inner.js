const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');

async function run() {
    const drive = google.drive({ version: 'v3', auth: serviceAccountClient });
    const res = await drive.files.list({
        q: "'1ueYDRIYkxicq_6QKG0-oB05trbmprpOd' in parents",
        fields: 'files(id, name, mimeType, webViewLink, webContentLink)'
    });
    console.log(JSON.stringify(res.data.files, null, 2));
}
run();
