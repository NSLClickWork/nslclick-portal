const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');
const { getAllStudents } = require('../services/sheets');

let groq;
const groqKey = process.env.GROQ_API_KEY;
if (groqKey) {
    groq = new Groq({ apiKey: groqKey });
}
const systemInstruction = "You are Sharkie, an AI Recruiting Assistant for the NSL system. Answer concisely, professionally, and use Markdown for formatting (e.g. bold, bullet points). You are chatting via a widget on the NSL Admin Dashboard. Use the provided candidate database to answer queries. ONLY suggest candidates that are actually in the provided database. DO NOT invent or hallucinate names.";

router.post('/message', async (req, res) => {
    try {
        const { message, filteredIds } = req.body;
        if (!groq) {
            return res.json({ reply: 'AI đang bảo trì (chưa cấu hình GROQ_API_KEY). Vui lòng thử lại sau.' });
        }

        let students = await getAllStudents();
        if (Array.isArray(filteredIds) && filteredIds.length > 0) {
            students = students.filter(s => filteredIds.includes(s.StudentID));
        }
        const studentData = students.map(s => `- ${s.FullName} (ID: ${s.StudentID}), Profession: ${s.ProfessionCode || 'N/A'}, NSL Score: ${s.NSLScore || 0}, NSL Rank: ${s.NSLGrade || 'N/A'}, Superpowers: ${[s.Strength1, s.Strength2, s.Strength3].filter(Boolean).join(', ')}, Video: ${s.YouTubeLink || s['Introduction Video'] || 'No Video'}`).join('\n');

        const userLang = req.session.lang || 'de';
        const langMap = { 'vi': 'Vietnamese', 'en': 'English', 'de': 'German' };
        const replyLang = langMap[userLang];

        const fullPrompt = `You must reply in ${replyLang}. When listing candidates, show their NSL Score instead of German Level, and if they have a Video link, provide it as a clickable markdown link [Watch Video](link).\n\nHere is the current NSL candidate database:\n${studentData}\n\nUser Message: ${message}`;
        
        const response = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            temperature: 0.2,
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: fullPrompt }
            ]
        });
        
        const responseText = response.choices[0].message.content;

        res.json({ reply: responseText });
    } catch (error) {
        console.error(error);
        res.status(500).json({ reply: 'Xin lỗi, tôi gặp lỗi khi xử lý tin nhắn của bạn.' });
    }
});

module.exports = router;
