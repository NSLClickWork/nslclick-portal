const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const { serviceAccountClient } = require('../services/googleAuth');
const sheetsService = require('../services/sheets');
const driveService = require('../services/drive');

// Student Profile
router.get('/student', (req, res) => res.redirect('/profile'));

router.get('/profile', async (req, res) => {
    if (!req.session.studentId) {
        return res.redirect('/');
    }

    const student = await sheetsService.getStudentById(req.session.studentId);
    if (!student || student.Status === 'ARCHIVED') {
        req.session = null;
        return res.redirect('/');
    }
    const isGdprSigned = req.session.gdprSigned || await sheetsService.hasSignedGDPR(req.session.studentId);
    if (isGdprSigned) {
        req.session.gdprSigned = true; // Cache in session
    }
    
    res.render('profile', { student, needsGdprConsent: !isGdprSigned });
});

// Submit GDPR Consent
router.post('/profile/gdpr-consent', express.urlencoded({ extended: true }), async (req, res) => {
    if (!req.session.studentId) return res.redirect('/');
    
    const { gdpr_fullname, gdpr_dob, gdpr_centercode, gdpr_email } = req.body;
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;

    const logData = {
        studentId: req.session.studentId,
        fullName: gdpr_fullname,
        dob: gdpr_dob,
        centerCode: gdpr_centercode,
        email: gdpr_email,
        ipAddress: ipAddress,
        consentVersion: '1.0-official'
    };

    const success = await sheetsService.logGDPRConsent(logData);
    if (success) {
        req.session.gdprSigned = true;
        res.redirect('/profile');
    } else {
        res.status(500).send('Error saving GDPR consent. Please try again.');
    }
});

// Shared Photo Proxy Helper
// Giúp tái sử dụng logic cho cả Photo và Activity Photo mà không cần copy-paste
function proxyStudentPhoto(photoField, options = {}) {
    const { checkPartnerPermission = false } = options;

    return async (req, res) => {
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
        if (checkPartnerPermission && isPartner && !isAdminReq && !isSelf) {
            const partnerConfig = req.session.partner;
            const allowedProfessions = partnerConfig.allowedProfessions ? partnerConfig.allowedProfessions.split(',').map(s => s.trim().toLowerCase()) : [];
            const allowedCenters = partnerConfig.allowedCenters ? partnerConfig.allowedCenters.split(',').map(s => s.trim().toLowerCase()) : [];
            
            const p = (student.ProfessionCode || '').toLowerCase();
            const pMatch = allowedProfessions.includes('*') || allowedProfessions.some(ap => p.includes(ap));
            const cMatch = allowedCenters.includes('*') || allowedCenters.includes((student.CenterCode || '').toLowerCase());
            if (!pMatch || !cMatch) {
                return res.status(403).send('Forbidden');
            }
        }

        const photoDriveId = driveService.extractDriveId(student[photoField]);
        if (!photoDriveId) {
            return res.status(404).send('No Photo');
        }

        try {
            res.redirect(`https://drive.google.com/thumbnail?id=${photoDriveId}&sz=w800`);
        } catch (err) {
            console.error(`${photoField} proxy error:`, err.message);
            res.status(500).send('Error');
        }
    };
}

// Photo Proxy Route (có kiểm tra quyền Partner)
router.get('/proxy/students/:studentId/photo', proxyStudentPhoto('PhotoLink', { checkPartnerPermission: true }));

// Activity Photo Proxy Route (không kiểm tra quyền Partner)
router.get('/proxy/students/:studentId/activity-photo', proxyStudentPhoto('ActivityPhotoLink'));

module.exports = router;
