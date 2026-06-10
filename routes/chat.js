const express = require('express');
const router = express.Router();
const geminiService = require('../services/gemini');
const { logChatRequest } = require('../services/sheets');

router.post('/message', async (req, res) => {
    try {
        const { message, filteredIds } = req.body;
        
        let userRole = 'partner';
        if (req.session && req.session.isAdmin) {
            userRole = 'admin';
        }

        const userLang = req.session.lang || 'de';
        const partnerConfig = req.session.partner;

        let responseText = await geminiService.chatWithGemini(message, userRole, userLang, partnerConfig, filteredIds);

        // Extract chosen candidate tag if present
        let chosenCandidate = '';
        const chosenMatch = responseText.match(/\[CHOSEN_CANDIDATE:\s*([^\]]+)\]/);
        if (chosenMatch) {
            chosenCandidate = chosenMatch[1].trim();
            // Remove the tag from the final output so the user doesn't see it
            responseText = responseText.replace(/\[CHOSEN_CANDIDATE:\s*[^\]]+\]/g, '').trim();
        }

        // Log the chat to Google Sheets
        await logChatRequest({
            partnerId: partnerConfig ? partnerConfig.partnerName : (userRole === 'admin' ? 'ADMIN' : 'GUEST'),
            role: userRole,
            language: userLang,
            userMessage: message,
            botReply: responseText,
            chosenCandidate: chosenCandidate
        });

        res.json({ reply: responseText });
    } catch (error) {
        console.error("Chat Error:", error);
        res.status(500).json({ reply: 'Xin lỗi, hệ thống AI đang quá tải hoặc gặp lỗi. Vui lòng thử lại sau!' });
    }
});

module.exports = router;
