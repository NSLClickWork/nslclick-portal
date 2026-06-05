const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// 1. Service Account Client (For Google Sheets and Google Drive)
let serviceAccountClient = null;
const credsPath = path.join(__dirname, '../credentials.json');

if (process.env.GOOGLE_CREDENTIALS_JSON) {
    try {
        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
        serviceAccountClient = new google.auth.GoogleAuth({
            credentials,
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/drive.file'
            ]
        });
    } catch (err) {
        console.error('Error parsing GOOGLE_CREDENTIALS_JSON:', err);
    }
} else if (fs.existsSync(credsPath)) {
    serviceAccountClient = new google.auth.GoogleAuth({
        keyFile: credsPath,
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/drive.file'
        ]
    });
} else {
    console.warn('Warning: credentials.json or GOOGLE_CREDENTIALS_JSON not found. Service Account features will not work.');
}

// 2. OAuth2 Client (For YouTube Uploads - requires real user context)
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'https://new-solution.eu/portal/oauth2callback'
);

const tokenPath = path.join(__dirname, '../token.json');
if (process.env.GOOGLE_YOUTUBE_TOKEN_JSON) {
    try {
        const token = JSON.parse(process.env.GOOGLE_YOUTUBE_TOKEN_JSON);
        oauth2Client.setCredentials(token);
    } catch (err) {
        console.error('Error parsing GOOGLE_YOUTUBE_TOKEN_JSON:', err);
    }
} else if (fs.existsSync(tokenPath)) {
    try {
        const tokenStr = fs.readFileSync(tokenPath, 'utf8');
        const token = JSON.parse(tokenStr);
        oauth2Client.setCredentials(token);
    } catch (err) {
        console.error('Error reading token.json:', err);
    }
} else if (process.env.GOOGLE_REFRESH_TOKEN) {
    oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });
}

function getAuthUrl() {
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/youtube.upload']
    });
}

module.exports = {
    serviceAccountClient,
    oauth2Client,
    getAuthUrl
};
