const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const sheetsService = require('../services/sheets');

// Rate Limiting for Login routes
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 login requests per windowMs
    message: 'Too many login attempts from this IP, please try again after 15 minutes.'
});

// Turnstile Validation Helper
async function verifyTurnstile(token, ip) {
    if (!token) return false;
    const secret = process.env.TURNSTILE_SECRET || '1x0000000000000000000000000000000AA';
    
    try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ secret, response: token, remoteip: ip })
        });
        const data = await response.json();
        return data.success;
    } catch (e) {
        console.error('Turnstile verification error:', e);
        return false;
    }
}

// ==================== Student Auth ====================
router.get('/', (req, res) => res.redirect('/partner'));
router.get('/student', (req, res) => res.render('login', { error: null, tab: 'student', turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '1x00000000000000000000AA' }));
router.get('/login', (req, res) => res.redirect('/student'));

// Student Login: Requires StudentID
router.post('/login', loginLimiter, async (req, res) => {
    const turnstileToken = req.body['cf-turnstile-response'];
    const isBot = !(await verifyTurnstile(turnstileToken, req.ip));
    if (isBot) {
        return res.render('login', { error: 'CAPTCHA validation failed. Please try again.', tab: 'student', turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '1x00000000000000000000AA' });
    }

    const { studentId } = req.body;
    
    if (!studentId) {
        return res.render('login', { error: 'Please enter Student ID.', tab: 'student', turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '1x00000000000000000000AA' });
    }

    const student = await sheetsService.getStudentById(studentId);
    
    if (student && student.Status !== 'ARCHIVED') {
        req.session.studentId = student.StudentID;
        return res.redirect('/profile');
    } else {
        return res.render('login', { error: 'Invalid Student ID.', tab: 'student', turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '1x00000000000000000000AA' });
    }
});

router.get('/logout', (req, res) => {
    req.session = null;
    res.redirect('/');
});

// ==================== Partner Auth ====================
router.get('/partner', (req, res) => res.render('login', { error: null, tab: 'partner', turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '1x00000000000000000000AA' }));
router.get('/partner/login', (req, res) => res.redirect('/partner'));

router.post('/partner/login', loginLimiter, async (req, res) => {
    const turnstileToken = req.body['cf-turnstile-response'];
    const isBot = !(await verifyTurnstile(turnstileToken, req.ip));
    if (isBot) {
        return res.render('login', { error: 'CAPTCHA validation failed. Please try again.', tab: 'partner', turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '1x00000000000000000000AA' });
    }

    const { accessCode } = req.body;
    if (!accessCode) {
        return res.render('login', { error: 'Please enter Access Code.', tab: 'partner', turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '1x00000000000000000000AA' });
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

    res.render('login', { error: 'Invalid Access Code.', tab: 'partner', turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '1x00000000000000000000AA' });
});

router.get('/partner/logout', (req, res) => {
    req.session.partner = null;
    res.redirect('/partner/login');
});

// ==================== Admin Auth ====================
router.get('/admin', (req, res) => res.render('login', { error: null, tab: 'admin', turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '1x00000000000000000000AA' }));
router.get('/admin/login', (req, res) => res.redirect('/admin'));

router.post('/admin/login', loginLimiter, async (req, res) => {
    const turnstileToken = req.body['cf-turnstile-response'];
    const isBot = !(await verifyTurnstile(turnstileToken, req.ip));
    if (isBot) {
        return res.render('login', { error: 'CAPTCHA validation failed. Please try again.', tab: 'admin', turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '1x00000000000000000000AA' });
    }

    const { password } = req.body;
    if (!password) {
        return res.render('login', { error: 'Please enter password.', tab: 'admin', turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '1x00000000000000000000AA' });
    }
    
    const adminHash = process.env.ADMIN_PASSWORD_HASH;
    if (!adminHash) {
        if (password.trim() === (process.env.ADMIN_PASSWORD || 'admin123').trim()) {
            req.session.isAdmin = true;
            return res.redirect('/admin');
        }
    } else {
        const match = await bcrypt.compare(password.trim(), adminHash);
        if (match) {
            req.session.isAdmin = true;
            return res.redirect('/admin');
        }
    }

    res.render('login', { error: 'Invalid password. (Note: Default is admin123)', tab: 'admin', turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '1x00000000000000000000AA' });
});

router.get('/admin/logout', (req, res) => {
    req.session = null;
    res.redirect('/');
});

module.exports = router;
