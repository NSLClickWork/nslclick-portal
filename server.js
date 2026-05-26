require('dotenv').config();
const express = require('express');
const session = require('cookie-session');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const bcrypt = require('bcrypt');
const sheetsService = require('./services/sheets');

const app = express();
const PORT = process.env.PORT || 3000;

// Multer setup - Use /tmp for Vercel (read-only filesystem)
const upload = multer({ dest: process.env.VERCEL ? '/tmp' : 'uploads/' });

// Handle folder creation for local dev
const uploadsDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsDir)) {
    try {
        fs.mkdirSync(uploadsDir, { recursive: true });
    } catch (e) {
        console.warn('Warning: Could not create uploads directory. This is expected on serverless environments like Vercel.');
    }
}

// Asset Upload setup (Photo, CV, Video)
const assetStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Fallback to /tmp which is writable on Vercel
        const dest = process.env.VERCEL ? '/tmp' : 'public/uploads/';
        cb(null, dest);
    },
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const uploadAssets = multer({ storage: assetStorage });

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const i18nMiddleware = require('./middlewares/i18n');

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Security Headers
app.use(helmet({
    contentSecurityPolicy: false, // Disable for now to not break external scripts/assets
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Global unhandled rejection handler to prevent server from crashing on Google API quota errors
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});

// Prevent missing static files (like /favicon.ico) from falling through and regenerating CSRF tokens
app.use((req, res, next) => {
    if (req.path.match(/\.(ico|png|jpg|jpeg|css|js|map|json)$/)) {
        return res.status(404).end();
    }
    next();
});

// Cookie & Session
app.use(cookieParser(process.env.SESSION_SECRET || 'nsl-secret-cookie'));
app.use(session({
    name: 'nsl_session',
    keys: [process.env.SESSION_SECRET || 'nsl-secret-session'],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax'
}));

// Apply i18n Middleware
app.use(i18nMiddleware);

// Custom CSRF Protection (Session-based, multi-tab safe)
const crypto = require('crypto');
app.use((req, res, next) => {
    // Skip CSRF for webhooks if any
    if (req.path.startsWith('/api/webhook')) return next();

    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        // Tạm thời bỏ qua check CSRF cho Login để tránh lỗi lặt vặt (hoặc user quên F5)
        if (req.path.startsWith('/login')) {
            if (!req.session.csrfSecret) req.session.csrfSecret = crypto.randomUUID();
            res.locals.csrfToken = req.session.csrfSecret;
            return next();
        }

        const token = req.body._csrf || req.query._csrf || req.headers['x-csrf-token'];
        const expected = req.session.csrfSecret;
        if (!expected || token !== expected) {
            console.error(`CSRF mismatch: expected ${expected}, got ${token}`);
            return res.status(403).send('CSRF token mismatch. Please refresh the page and try again.');
        }
    }

    if (!req.session.csrfSecret) {
        req.session.csrfSecret = crypto.randomUUID();
    }
    res.locals.csrfToken = req.session.csrfSecret;
    next();
});

// Rate Limiting for Login routes
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 login requests per windowMs
    message: 'Too many login attempts from this IP, please try again after 15 minutes.'
});
// Admin Middleware
function isAdmin(req, res, next) {
    if (req.session.isAdmin) {
        next();
    } else {
        res.redirect('/admin/login');
    }
}

// Mock data and Graph API have been removed.
// All data fetching is now handled by sheetsService.

// YouTube OAuth Routes (Admin only)
const { getAuthUrl, oauth2Client } = require('./services/googleAuth');
app.get('/auth/google', isAdmin, (req, res) => {
    res.redirect(getAuthUrl());
});

app.get('/oauth2callback', isAdmin, async (req, res) => {
    const code = req.query.code;
    if (!code) {
        return res.status(400).send('No code provided');
    }
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        fs.writeFileSync(path.join(__dirname, 'token.json'), JSON.stringify(tokens));
        res.send('Authorization successful! token.json has been saved. You can now close this tab and trigger video uploads.');
    } catch (err) {
        console.error('Error getting OAuth tokens:', err);
        res.status(500).send('Authentication failed');
    }
});

// Student Routes
app.get('/', (req, res) => res.render('login', { error: null, tab: req.query.tab || 'student' }));
app.get('/login', (req, res) => res.redirect('/'));

// Student Login: Requires StudentID
app.post('/login', loginLimiter, async (req, res) => {
    const { studentId } = req.body;
    
    if (!studentId) {
        return res.render('login', { error: 'Please enter Student ID.', tab: 'student' });
    }

    const student = await sheetsService.getStudentById(studentId);
    
    if (student && student.Status !== 'ARCHIVED') {
        req.session.studentId = student.StudentID;
        return res.redirect('/profile');
    } else {
        return res.render('login', { error: 'Invalid Student ID.', tab: 'student' });
    }
});

app.get('/profile', async (req, res) => {
    if (!req.session.studentId) {
        return res.redirect('/');
    }

    const student = await sheetsService.getStudentById(req.session.studentId);
    if (!student || student.Status === 'ARCHIVED') {
        req.session = null;
        return res.redirect('/');
    }
    
    res.render('profile', { student });
});

app.get('/logout', (req, res) => {
    req.session = null;
    res.redirect('/');
});

// Photo Proxy Route
app.get('/proxy/students/:studentId/photo', async (req, res) => {
    const studentId = req.params.studentId;
    
    // Auth Check
    const isAdminReq = req.session.isAdmin;
    const isSelf = req.session.studentId === studentId;
    const isPartner = req.session.partner != null;
    
    if (!isAdminReq && !isSelf && !isPartner) {
        return res.status(403).send('Forbidden');
    }

    const student = await sheetsService.getStudentById(studentId);
    if (!student || student.Status === 'ARCHIVED') {
        return res.status(404).send('Not Found');
    }

    // If Partner, check if they are allowed to see this student
    if (isPartner && !isAdminReq && !isSelf) {
        const partnerConfig = req.session.partner;
        const allowedProfessions = partnerConfig.allowedProfessions ? partnerConfig.allowedProfessions.split(',').map(s => s.trim().toLowerCase()) : [];
        const allowedCenters = partnerConfig.allowedCenters ? partnerConfig.allowedCenters.split(',').map(s => s.trim().toLowerCase()) : [];
        
        const pMatch = allowedProfessions.includes('*') || allowedProfessions.includes((student.ProfessionCode || '').toLowerCase());
        const cMatch = allowedCenters.includes('*') || allowedCenters.includes((student.CenterCode || '').toLowerCase());
        if (!pMatch || !cMatch) {
            return res.status(403).send('Forbidden');
        }
    }

    const driveService = require('./services/drive');
    const photoDriveId = driveService.extractDriveId(student.PhotoLink);
    if (!photoDriveId) {
        return res.status(404).send('No Photo');
    }

    try {
        const { google } = require('googleapis');
        const { serviceAccountClient } = require('./services/googleAuth');
        const drive = google.drive({ version: 'v3', auth: serviceAccountClient });
        
        const response = await drive.files.get({ fileId: photoDriveId, alt: 'media' }, { responseType: 'stream' });
        res.setHeader('Content-Type', 'image/jpeg');
        response.data.pipe(res);
    } catch (err) {
        console.error('Photo proxy error:', err.message);
        res.status(500).send('Error');
    }
});

// Activity Photo Proxy Route
app.get('/proxy/students/:studentId/activity-photo', async (req, res) => {
    const studentId = req.params.studentId;
    
    // Auth Check
    const isAdminReq = req.session.isAdmin;
    const isSelf = req.session.studentId === studentId;
    const isPartner = req.session.partner != null;
    
    if (!isAdminReq && !isSelf && !isPartner) {
        return res.status(403).send('Forbidden');
    }

    const student = await sheetsService.getStudentById(studentId);
    if (!student || student.Status === 'ARCHIVED') {
        return res.status(404).send('Not Found');
    }

    const driveService = require('./services/drive');
    const photoDriveId = driveService.extractDriveId(student.ActivityPhotoLink);
    if (!photoDriveId) {
        return res.status(404).send('No Photo');
    }

    try {
        const { google } = require('googleapis');
        const { serviceAccountClient } = require('./services/googleAuth');
        const drive = google.drive({ version: 'v3', auth: serviceAccountClient });
        
        const response = await drive.files.get({ fileId: photoDriveId, alt: 'media' }, { responseType: 'stream' });
        res.setHeader('Content-Type', 'image/jpeg');
        response.data.pipe(res);
    } catch (err) {
        console.error('Activity Photo proxy error:', err.message);
        res.status(500).send('Error');
    }
});

// Partner Routes
app.get('/partner/login', (req, res) => res.redirect('/?tab=partner'));

app.post('/partner/login', loginLimiter, async (req, res) => {
    const { accessCode } = req.body;
    if (!accessCode) {
        return res.render('login', { error: 'Please enter Access Code.', tab: 'partner' });
    }

    const configs = await sheetsService.getPartnerAccessConfigs();
    let validPartner = null;
    
    for (const config of configs) {
        if (config.revoked === 'TRUE') continue;
        if (config.expiresAt && new Date(config.expiresAt) < new Date()) continue;
        
        if (!config.codeHash) continue;
        const match = await bcrypt.compare(accessCode, config.codeHash);
        if (match) {
            validPartner = config;
            break;
        }
    }

    // Fallback cho quá trình test
    if (!validPartner && accessCode === 'partner123') {
        validPartner = {
            id: 'test-partner',
            partnerName: 'Test Partner (Fallback)',
            allowedProfessions: '*',
            allowedCenters: '*'
        };
    }

    if (validPartner) {
        req.session.partner = validPartner;
        return res.redirect('/partner/dashboard');
    }

    res.render('login', { error: 'Invalid Access Code.', tab: 'partner' });
});

app.get('/partner/dashboard', async (req, res) => {
    if (!req.session.partner) return res.redirect('/partner/login');

    const partnerConfig = req.session.partner;
    const lang = req.query.lang || 'vi'; // default lang
    
    try {
        const allowedProfessions = partnerConfig.allowedProfessions ? partnerConfig.allowedProfessions.split(',').map(s => s.trim().toLowerCase()) : [];
        const allowedCenters = partnerConfig.allowedCenters ? partnerConfig.allowedCenters.split(',').map(s => s.trim().toLowerCase()) : [];

        const allStudents = await sheetsService.getAllStudents();
        const filteredStudents = [];
        for (const s of allStudents) {
            if (s.Status === 'ARCHIVED') continue;
            
            let newS = { ...s }; // Clone to avoid modifying the cached student object
            let pMatch = allowedProfessions.includes('*');
            
            if (!pMatch && s.ProfessionCode) {
                // Split by both / and ,
                const studentProfs = s.ProfessionCode.split(/[,/]/).map(p => p.trim());
                // Find intersection
                const matchedProfs = studentProfs.filter(p => 
                    allowedProfessions.some(ap => p.toLowerCase().includes(ap))
                );
                
                if (matchedProfs.length > 0) {
                    // Rejoin with comma for display
                    newS.ProfessionCode = matchedProfs.join(', ');
                    pMatch = true;
                }
            }
            
            const cMatch = allowedCenters.includes('*') || (s.CenterCode && allowedCenters.includes(s.CenterCode.toLowerCase()));
            
            if (pMatch && cMatch) {
                filteredStudents.push(newS);
            }
        }

        res.render('partner/dashboard', { students: filteredStudents });
    } catch (err) {
        console.error('Error in partner dashboard:', err);
        res.render('partner/dashboard', { students: [], error: 'Failed to load candidates due to Google API limits.' });
    }
});

app.get('/partner/logout', (req, res) => {
    req.session.partner = null;
    res.redirect('/partner/login');
});

// Admin Routes
app.get('/admin/login', (req, res) => res.redirect('/?tab=admin'));

app.post('/admin/login', loginLimiter, async (req, res) => {
    const { password } = req.body;
    if (!password) {
        return res.render('login', { error: 'Please enter password.', tab: 'admin' });
    }
    
    const adminHash = process.env.ADMIN_PASSWORD_HASH;
    if (!adminHash) {
        if (password === (process.env.ADMIN_PASSWORD || 'admin123')) {
            req.session.isAdmin = true;
            return res.redirect('/admin');
        }
    } else {
        const match = await bcrypt.compare(password, adminHash);
        if (match) {
            req.session.isAdmin = true;
            return res.redirect('/admin');
        }
    }

    res.render('login', { error: 'Invalid password.', tab: 'admin' });
});

app.get('/admin/logout', (req, res) => {
    req.session = null;
    res.redirect('/');
});

app.get('/admin', isAdmin, async (req, res) => {
    res.render('admin/dashboard');
});

app.get('/admin/students', isAdmin, async (req, res) => {
    try {
        let students = await sheetsService.getAllStudents();
        res.json(students);
    } catch (err) {
        console.error('Error fetching students:', err);
        res.status(500).json({ error: 'Failed to fetch students. Quota might be exceeded.' });
    }
});

app.post('/admin/students', isAdmin, async (req, res) => {
    try {
        const studentData = { ...req.body, Status: 'ACTIVE' };
        const student = await sheetsService.addStudent(studentData);
        res.json(student);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/admin/students/:id', isAdmin, async (req, res) => {
    try {
        const allowedFields = [
            'FullName', 'Phone', 'CCCD', 'VoucherCode', 'ProfessionCode', 
            'CenterCode', 'DeutschLevel', 'Strength1', 'Strength2', 'Strength3', 
            'AvailableFrom', 'AssessmentScore', 'VideoScore', 'PhotoLink', 'RawVideoLink'
        ];
        
        const updates = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        }
        
        await sheetsService.updateStudentFields(req.params.id, updates);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/admin/students/:id/archive', isAdmin, async (req, res) => {
    try {
        await sheetsService.updateStudentFields(req.params.id, { Status: 'ARCHIVED' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/admin/students/:id/restore', isAdmin, async (req, res) => {
    try {
        await sheetsService.updateStudentFields(req.params.id, { Status: 'ACTIVE' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Import services for jobs
const pdfService = require('./services/pdf');
const videoService = require('./services/video');
const jobsService = require('./services/jobs');

app.post('/admin/batch/pdfs', isAdmin, async (req, res) => {
    const { studentIds } = req.body;
    if (!studentIds || !Array.isArray(studentIds)) {
        return res.status(400).json({ error: 'studentIds array is required' });
    }

    const queuedJobs = studentIds.map(id => pdfService.enqueuePdfJob(id));
    res.json({ message: 'Jobs queued successfully', jobs: queuedJobs });
});

app.post('/admin/batch/videos', isAdmin, async (req, res) => {
    const { studentIds, type } = req.body;
    if (!studentIds || !Array.isArray(studentIds)) {
        return res.status(400).json({ error: 'studentIds array is required' });
    }

    const queuedJobs = studentIds.map(id => videoService.enqueueVideoJob(id, type || 'vertical'));
    res.json({ message: 'Jobs queued successfully', jobs: queuedJobs });
});

app.get('/admin/jobs/:jobId', isAdmin, (req, res) => {
    const job = jobsService.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
});

// Only start the server if running locally
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

module.exports = app;
