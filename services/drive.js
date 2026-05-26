const { google } = require('googleapis');
const { serviceAccountClient } = require('./googleAuth');
const fs = require('fs');
const path = require('path');

const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

async function getDriveInstance() {
    if (!serviceAccountClient) throw new Error('Service Account Client not configured.');
    return google.drive({ version: 'v3', auth: serviceAccountClient });
}

/**
 * Upload file lên Google Drive
 */
async function uploadToDrive(filePath, fileName, mimeType) {
    const drive = await getDriveInstance();
    
    try {
        const fileMetadata = {
            name: fileName,
            parents: DRIVE_FOLDER_ID ? [DRIVE_FOLDER_ID] : []
        };
        const media = {
            mimeType: mimeType,
            body: fs.createReadStream(filePath)
        };
        
        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, webViewLink, webContentLink'
        });
        
        // Share public (hoặc Anyone with link có thể xem)
        await drive.permissions.create({
            fileId: response.data.id,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            }
        });

        return response.data.webViewLink; // Link để xem trực tiếp
    } catch (error) {
        console.error('Error uploading to Google Drive:', error);
        throw error;
    }
}

/**
 * Tải file từ Google Drive về local
 */
async function downloadFromDrive(fileId, destPath) {
    const drive = await getDriveInstance();
    
    return new Promise(async (resolve, reject) => {
        try {
            const dest = fs.createWriteStream(destPath);
            const res = await drive.files.get(
                { fileId: fileId, alt: 'media' },
                { responseType: 'stream' }
            );

            res.data
                .on('end', () => resolve(destPath))
                .on('error', err => reject(err))
                .pipe(dest);
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Trích xuất File ID từ link Google Drive
 */
function extractDriveId(url) {
    if (!url) return null;
    const match = url.match(/[-\w]{25,}/);
    return match ? match[0] : null;
}

module.exports = {
    uploadToDrive,
    downloadFromDrive,
    extractDriveId
};
