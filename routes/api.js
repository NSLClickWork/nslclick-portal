const express = require('express');
const router = express.Router();
const geminiService = require('../services/gemini');

router.post('/chat', async (req, res) => {
    try {
        const { prompt, role, filteredIds } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }
        
        // Determine role for Gemini context isolation
        let userRole = role || 'partner';
        if (req.session && req.session.isAdmin) {
            userRole = 'admin';
        }

        const userLang = req.session.lang || 'de';
        const partnerConfig = req.session.partner;
        const responseText = await geminiService.chatWithGemini(prompt, userRole, userLang, partnerConfig, filteredIds);
        res.json({ response: responseText });
    } catch (error) {
        console.error("Chat API Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
