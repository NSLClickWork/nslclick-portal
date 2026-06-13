const express = require('express');
const router = express.Router();
const sheetsService = require('../services/sheets');
const ragService = require('../services/rag');
const pineconeService = require('../services/pinecone');
const multer = require('multer');
const fs = require('fs');
const upload = multer({ dest: process.env.VERCEL ? '/tmp' : 'public/uploads/' });

router.get('/partner', (req, res) => res.redirect('/partner/dashboard'));

router.get('/partner/dashboard', async (req, res) => {
    if (!req.session.partner) return res.redirect('/partner/login');

    const partnerConfig = req.session.partner;
    
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

        res.render('partner/dashboard', { students: filteredStudents, partner: partnerConfig });
    } catch (err) {
        console.error('Error in partner dashboard:', err);
        res.render('partner/dashboard', { students: [], error: 'Failed to load candidates due to Google API limits.', partner: partnerConfig || null });
    }
});

// ==================== Partner RAG Management ====================
router.post('/partner/rag/upload', upload.single('document'), async (req, res) => {
    if (!req.session.partner) return res.status(401).json({ error: 'Unauthorized' });
    if (!req.file) {
        return res.status(400).json({ error: 'No document file uploaded' });
    }
    
    try {
        const result = await ragService.syncSingleDocumentToPinecone(req.file.path, req.file.originalname);
        try { fs.unlinkSync(req.file.path); } catch (e) {}
        
        res.json({ success: true, message: `Successfully synced document. Generated ${result.chunks} vector chunks.` });
    } catch (error) {
        console.error('RAG Upload Error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/partner/rag/list/:studentId', async (req, res) => {
    if (!req.session.partner) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const sessions = await pineconeService.listDocumentsByStudent(req.params.studentId);
        res.json({ success: true, sessions });
    } catch (error) {
        console.error('RAG List Error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/partner/rag/delete', express.json(), async (req, res) => {
    if (!req.session.partner) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const { studentId, vectorIds } = req.body;
        
        if (!studentId && (!vectorIds || vectorIds.length === 0)) {
            return res.status(400).json({ error: 'Must provide vectorIds to delete' });
        }

        let idsToDelete = vectorIds;
        
        if (studentId && (!vectorIds || vectorIds.length === 0)) {
            const sessions = await pineconeService.listDocumentsByStudent(studentId);
            idsToDelete = sessions.flatMap(s => s.vectorIds);
        }

        if (idsToDelete && idsToDelete.length > 0) {
            await pineconeService.deleteDocuments(idsToDelete);
            res.json({ success: true, message: `Successfully deleted ${idsToDelete.length} vector chunks.` });
        } else {
            res.json({ success: true, message: `No documents found to delete.` });
        }
    } catch (error) {
        console.error('RAG Delete Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
