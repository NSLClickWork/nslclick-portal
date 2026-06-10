const express = require('express');
const router = express.Router();
const sheetsService = require('../services/sheets');

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

module.exports = router;
