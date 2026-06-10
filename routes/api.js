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
        let responseText = await geminiService.chatWithGemini(prompt, userRole, userLang, partnerConfig, filteredIds);
        
        // Extract chosen candidate tag if present
        let chosenCandidate = '';
        const chosenMatch = responseText.match(/\[\s*CHOSEN_CANDIDATE\s*:\s*([^\]]+)\]/i);
        if (chosenMatch) {
            chosenCandidate = chosenMatch[1].trim();
            // Remove the tag from the final output so the user doesn't see it
            responseText = responseText.replace(/\[\s*CHOSEN_CANDIDATE\s*:\s*[^\]]+\]/gi, '').trim();
        }

        // Log the chat to Google Sheets
        const sheetsService = require('../services/sheets');
        await sheetsService.logChatRequest({
            partnerId: partnerConfig ? partnerConfig.partnerName : (userRole === 'admin' ? 'ADMIN' : 'GUEST'),
            role: userRole,
            language: userLang,
            userMessage: prompt,
            botReply: responseText,
            chosenCandidate: chosenCandidate
        });

        res.json({ response: responseText });
    } catch (error) {
        console.error("Chat API Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
