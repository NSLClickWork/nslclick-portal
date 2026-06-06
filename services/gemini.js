const { GoogleGenAI } = require('@google/genai');
const sheetsService = require('./sheets');

// Initialize the Google Gen AI Client
let ai;
try {
    if (process.env.GEMINI_API_KEY) {
        ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
} catch (error) {
    console.warn("GoogleGenAI initialized without API key or failed. Make sure GEMINI_API_KEY is in your .env");
}

async function chatWithGemini(prompt, userRole = 'partner') {
    if (!ai || !process.env.GEMINI_API_KEY) {
        return "Lỗi: Chưa cấu hình GEMINI_API_KEY. Bạn vui lòng thêm biến môi trường này vào server để AI hoạt động nhé!";
    }

    try {
        // Fetch context (RAG)
        const students = await sheetsService.getAllStudents();
        const partners = await sheetsService.getPartnerAccessConfigs();

        // Prepare context data. Limit fields to avoid massive token usage.
        const studentsContext = students.map(s => {
            return `- ID: ${s.StudentID} | Name: ${s.FullName} | Profession: ${s.ProfessionCode || 'N/A'} | NSL Score: ${s.NSLScore || '0'} | German Level: ${s.DeutschLevel || 'N/A'} | Available From: ${s.AvailableFrom || 'N/A'} | Strengths: ${[s.Strength1, s.Strength2].filter(Boolean).join(', ')}`;
        }).join('\n');

        let systemInstruction = "Your name is Sharkie. You are a smart AI recruiting assistant for NSL (New Solutions Europe). Your task is to read the provided database context to answer questions, search, and suggest candidates concisely and accurately.\n\nCRITICAL LANGUAGE RULE: You MUST detect the exact language of the user's prompt. If the user asks in English, your ENTIRE response MUST be in English. If they ask in Vietnamese, reply entirely in Vietnamese. If they ask in German, reply entirely in German. DO NOT use German unless the user specifically typed their question in German. IMPORTANT: You MUST translate all candidate data from the database (especially Profession and Strengths) into the detected language before inserting them into the flashcards. Never output German words like 'Pflegefachkraft' or 'Hohe Lernbereitschaft' if the user asked in English or Vietnamese.\n\nCRITICAL RULE: You MUST ONLY answer based on the provided database context. Do not invent, guess, or hallucinate any candidates or information. If you cannot find the answer or a suitable candidate in the database, or if the question is unrelated, you must politely decline and tell the user to contact newsolution.eu@gmail.com for further assistance.\n\nCRITICAL FORMATTING RULE: When you suggest candidates, you MUST format EACH candidate as a beautiful HTML flashcard. Use exactly this HTML code (replace bracketed text with data) on a SINGLE LINE so it renders perfectly:\n<div style=\"background: #fff; border: 2px solid #222; border-radius: 8px; padding: 15px; margin: 10px 0; box-shadow: 4px 4px 0px #222;\"><h4 style=\"margin: 0 0 10px 0; color: #cc1f1f; font-weight: 800; font-size: 16px;\">🦈 [Name]</h4><strong>ID:</strong> [ID] &nbsp;|&nbsp; <strong>Profession:</strong> [Profession]<br><strong>German Level:</strong> [German Level] &nbsp;|&nbsp; <strong>NSL Score:</strong> [NSL Score]<br><strong>Strengths:</strong> [Strengths]</div>\nDo NOT use standard markdown lists (*) for candidates anymore. ONLY use the HTML flashcard above.\n\n";
        
        if (userRole === 'admin') {
            const partnersContext = partners.map(p => `- Name: ${p.partnerName} | Status: ${p.revoked === 'TRUE' ? 'Revoked' : 'Active'} | Professions: ${p.allowedProfessions}`).join('\n');
            systemInstruction += `The user is an ADMIN. You have full access to all data.\n\n=== PARTNERS LIST ===\n${partnersContext}\n\n=== CANDIDATES LIST ===\n${studentsContext}`;
        } else {
            systemInstruction += `The user is a PARTNER (RECRUITER). Be professional and help them find candidates.\n\n=== CANDIDATES LIST ===\n${studentsContext}`;
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.2, // Low temp for factual data matching
            }
        });

        return response.text;
    } catch (error) {
        console.error("Gemini AI Error:", error);
        return "Xin lỗi, đã có lỗi xảy ra trong quá trình xử lý AI: " + error.message;
    }
}

module.exports = {
    chatWithGemini
};
