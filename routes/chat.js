const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getAllStudents } = require('../services/sheets');

let genAI;
let model;
if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ 
        model: "gemini-3.5-flash",
        systemInstruction: "You are Sharkie, an AI Recruiting Assistant for the NSL system. Answer concisely, professionally, and use Markdown for formatting (e.g. bold, bullet points). You are chatting via a widget on the NSL Admin Dashboard. Use the provided candidate database to answer queries. ONLY suggest candidates that are actually in the provided database. DO NOT invent or hallucinate names."
    });
}

router.post('/message', async (req, res) => {
    try {
        const { message } = req.body;
        if (!model) {
            return res.json({ reply: 'AI đang bảo trì (chưa có API Key). Vui lòng cấu hình GEMINI_API_KEY trong file .env' });
        }

        const students = await getAllStudents();
        const studentData = students.map(s => `- ${s.FullName} (ID: ${s.StudentID}), Profession: ${s.ProfessionCode || 'N/A'}, German Level: ${s.DeutschLevel || 'N/A'}, NSL Rank: ${s.NSLGrade || 'N/A'}, Superpowers: ${[s.Strength1, s.Strength2, s.Strength3].filter(Boolean).join(', ')}`).join('\n');

        const userLang = req.session.lang || 'de';
        const langMap = { 'vi': 'Vietnamese', 'en': 'English', 'de': 'German' };
        const replyLang = langMap[userLang];

        const fullPrompt = `You must reply in ${replyLang}.\n\nHere is the current NSL candidate database:\n${studentData}\n\nUser Message: ${message}`;
        const result = await model.generateContent(fullPrompt);
        const responseText = result.response.text();

        res.json({ reply: responseText });
    } catch (error) {
        console.error(error);
        res.status(500).json({ reply: 'Xin lỗi, tôi gặp lỗi khi xử lý tin nhắn của bạn.' });
    }
});

module.exports = router;
