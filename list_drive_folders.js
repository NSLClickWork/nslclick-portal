const { google } = require('googleapis');
const { serviceAccountClient } = require('./services/googleAuth');
const drive = google.drive({ version: 'v3', auth: serviceAccountClient });
const ROOT = '1bjsmFAXZ-B5Kq1Lpc0gIt0A-9LYNXbjB';
async function run() {
    const res = await drive.files.list({
        q: `'${ROOT}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id,name)', pageSize: 200
    });
    const folders = res.data.files;
    console.log(`Total folders: ${folders.length}\n`);
    for (const f of folders) {
        const fr = await drive.files.list({
            q: `'${f.id}' in parents and trashed=false`,
            fields: 'files(id,name,mimeType)', pageSize: 50
        });
        const files = fr.data.files || [];
        const hasPDF = files.some(x => x.mimeType === 'application/pdf');
        const hasImg = files.some(x => x.mimeType && x.mimeType.startsWith('image/'));
        const hasVid = files.some(x => x.mimeType && x.mimeType.startsWith('video/'));
        const noPdfTag = !hasPDF ? '  ← NO PDF' : '';
        console.log(`[${hasPDF?'PDF':'   '}][${hasImg?'IMG':'   '}][${hasVid?'VID':'   '}] ${f.name}${noPdfTag}`);
        if (!hasPDF) {
            files.forEach(x => console.log('    - ' + x.name + ' (' + x.mimeType + ')'));
        }
    }
}
run().catch(e => console.error(e.message));
