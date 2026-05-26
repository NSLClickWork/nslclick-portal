const { google } = require('googleapis');
const { oauth2Client } = require('./googleAuth');
const fs = require('fs');

/**
 * Uploads a video to YouTube
 * @param {String} filePath Local path to the video
 * @param {String} title Video Title
 * @param {String} description Video Description
 * @param {String} privacyStatus 'public', 'private', or 'unlisted'
 * @returns {String} YouTube Video URL
 */
async function uploadVideo(filePath, title, description, privacyStatus = 'unlisted') {
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    
    const res = await youtube.videos.insert({
        part: 'snippet,status',
        requestBody: {
            snippet: {
                title,
                description,
                tags: ['NSL', 'Candidate'],
                categoryId: '22', // People & Blogs
            },
            status: {
                privacyStatus,
                selfDeclaredMadeForKids: false
            },
        },
        media: {
            body: fs.createReadStream(filePath),
        },
    });

    return `https://www.youtube.com/watch?v=${res.data.id}`;
}

module.exports = {
    uploadVideo
};
