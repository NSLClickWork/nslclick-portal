const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const { getAuthUrl, oauth2Client } = require('../services/googleAuth');
const sheetsService = require('../services/sheets');
const pdfService = require('../services/pdf');
const videoService = require('../services/video');
const jobsService = require('../services/jobs');

// Admin Middleware
function isAdmin(req, res, next) {
    if (req.session.isAdmin) {
        next();
    } else {
        res.redirect('/admin/login');
    }
}

// ==================== YouTube OAuth (Admin only) ====================
router.get('/auth/google', isAdmin, (req, res) => {
    res.redirect(getAuthUrl());
});

router.get('/oauth2callback', isAdmin, async (req, res) => {
    const code = req.query.code;
    if (!code) {
        return res.status(400).send('No code provided');
    }
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        fs.writeFileSync(path.join(__dirname, '../token.json'), JSON.stringify(tokens));
        res.send('Authorization successful! token.json has been saved. You can now close this tab and trigger video uploads.');
    } catch (err) {
        console.error('Error getting OAuth tokens:', err);
        res.status(500).send('Authentication failed');
    }
});

// ==================== Admin Dashboard ====================
router.get('/admin', isAdmin, (req, res) => {
    res.redirect('/admin/dashboard');
});

router.get('/admin/dashboard', isAdmin, async (req, res) => {
    res.render('admin/dashboard');
});

// ==================== Admin Student CRUD ====================
router.get('/admin/students', isAdmin, async (req, res) => {
    try {
        let students = await sheetsService.getAllStudents();
        res.json(students);
    } catch (err) {
        console.error('Error fetching students:', err);
        res.status(500).json({ error: 'Failed to fetch students. Quota might be exceeded.' });
    }
});

router.post('/admin/students', isAdmin, async (req, res) => {
    try {
        const studentData = { ...req.body, Status: 'ACTIVE' };
        const student = await sheetsService.addStudent(studentData);
        res.json(student);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/admin/students/:id', isAdmin, async (req, res) => {
    try {
        const allowedFields = [
            'FullName', 'Phone', 'CCCD', 'VoucherCode', 'ProfessionCode', 
            'CenterCode', 'DeutschLevel', 'Strength1', 'Strength2', 'Strength3', 
            'AvailableFrom', 'AssessmentScore', 'VideoScore', 'PhotoLink', 'RawVideoLink', 'ProgressStatus'
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

router.put('/admin/students/:id/archive', isAdmin, async (req, res) => {
    try {
        await sheetsService.updateStudentFields(req.params.id, { Status: 'ARCHIVED' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/admin/students/:id/restore', isAdmin, async (req, res) => {
    try {
        await sheetsService.updateStudentFields(req.params.id, { Status: 'ACTIVE' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== Admin Partner Management ====================
router.get('/admin/partners', isAdmin, async (req, res) => {
    try {
        const partners = await sheetsService.getPartnerAccessConfigs();
        // Do not send password hashes to frontend
        const safePartners = partners.map(p => {
            const { codeHash, ...safePartner } = p;
            return safePartner;
        });
        res.json(safePartners);
    } catch (err) {
        console.error('Error fetching partners:', err);
        res.status(500).json({ error: 'Failed to fetch partners.' });
    }
});

router.post('/admin/partners', isAdmin, async (req, res) => {
    try {
        const { partnerName, allowedProfessions, allowedCenters, rawCode, expiresAt } = req.body;
        if (!partnerName || !rawCode) {
            return res.status(400).json({ error: 'Partner Name and Code are required.' });
        }
        
        const codeHash = await bcrypt.hash(rawCode, 10);
        
        const partnerConfig = {
            partnerName,
            codeHash,
            accessCode: rawCode,
            allowedProfessions: allowedProfessions || '*',
            allowedCenters: allowedCenters || '*',
            expiresAt: expiresAt || '',
            revoked: 'FALSE'
        };
        
        await sheetsService.addPartnerAccess(partnerConfig);
        res.json({ success: true, message: 'Partner created successfully.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/admin/partners/:rowIndex/revoke', isAdmin, async (req, res) => {
    try {
        const { revoked } = req.body;
        await sheetsService.updatePartnerAccess(req.params.rowIndex, { revoked: revoked ? 'TRUE' : 'FALSE' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/admin/partners/:rowIndex', isAdmin, async (req, res) => {
    try {
        await sheetsService.deletePartnerAccess(req.params.rowIndex);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== Batch Processing ====================
router.post('/admin/batch/pdfs', isAdmin, async (req, res) => {
    const { studentIds } = req.body;
    if (!studentIds || !Array.isArray(studentIds)) {
        return res.status(400).json({ error: 'studentIds array is required' });
    }

    const queuedJobs = studentIds.map(id => pdfService.enqueuePdfJob(id));
    res.json({ message: 'Jobs queued successfully', jobs: queuedJobs });
});

router.post('/admin/batch/videos', isAdmin, async (req, res) => {
    const { studentIds, type } = req.body;
    if (!studentIds || !Array.isArray(studentIds)) {
        return res.status(400).json({ error: 'studentIds array is required' });
    }

    const queuedJobs = studentIds.map(id => videoService.enqueueVideoJob(id, type || 'vertical'));
    res.json({ message: 'Jobs queued successfully', jobs: queuedJobs });
});

router.post('/admin/batch/progress', isAdmin, async (req, res) => {
    const { studentIds, newStatus } = req.body;
    if (!studentIds || !Array.isArray(studentIds) || !newStatus) {
        return res.status(400).json({ error: 'studentIds array and newStatus are required' });
    }

    try {
        await sheetsService.batchUpdateStudentsFields(studentIds, { ProgressStatus: newStatus });
        res.json({ success: true, message: 'Progress updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/admin/jobs/:jobId', isAdmin, (req, res) => {
    const job = jobsService.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
});

module.exports = router;
