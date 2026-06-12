require('dotenv').config();
const express = require('express');
const session = require('cookie-session');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const i18nMiddleware = require('./middlewares/i18n');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy headers for secure rate limiting behind tunnels (localtunnel, localhost.run, Vercel)
app.set('trust proxy', 1);

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

// ==================== Middleware ====================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Security Headers
app.use(helmet({
    contentSecurityPolicy: false, // Disable for now to not break external scripts/assets
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Prevent caching for dynamic routes to fix aggressive browser 302 caching (e.g. language switcher kickout)
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
});

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
    httpOnly: true,
    sameSite: 'lax'
}));

// Apply i18n Middleware
app.use(i18nMiddleware);

// Custom CSRF Protection (Session-based, multi-tab safe)
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

// Base URL Middleware for Subpath Support (e.g. /portal)
app.use((req, res, next) => {
    try {
        const url = new URL(process.env.BASE_URL || 'http://localhost:3000');
        let path = url.pathname;
        if (!path.endsWith('/')) path += '/';
        res.locals.appBaseUrl = path;
    } catch (e) {
        res.locals.appBaseUrl = '/';
    }

    // Override res.redirect to prepend the base path if redirecting to an absolute path
    const originalRedirect = res.redirect;
    res.redirect = function (url) {
        if (url.startsWith('/')) {
            const basePath = res.locals.appBaseUrl.replace(/\/$/, '');
            return originalRedirect.call(this, basePath + url);
        }
        return originalRedirect.call(this, url);
    };

    next();
});

// Inject global booking links to all templates
app.use((req, res, next) => {
    res.locals.candidateBookingLink = process.env.CANDIDATE_BOOKING_LINK || 'https://calendar.google.com/';
    res.locals.partnerBookingLink = process.env.PARTNER_BOOKING_LINK || 'https://calendar.google.com/';
    next();
});

// ==================== Routes ====================
app.use('/api/webhook', require('./routes/webhook'));
app.use('/api/chat', require('./routes/chat'));
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/student'));
app.use('/', require('./routes/partner'));
app.use('/', require('./routes/admin'));
app.use('/marketing', require('./routes/marketing'));
app.use('/api', require('./routes/api'));

// ==================== Start Server ====================
if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

module.exports = app;
