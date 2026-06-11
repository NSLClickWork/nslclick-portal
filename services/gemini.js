const Groq = require('groq-sdk');
const sheetsService = require('./sheets');

// Initialize the Groq Client
let ai;
try {
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
        ai = new Groq({ apiKey: groqKey });
    }
} catch (error) {
    console.warn("Groq initialized without API key or failed.");
}

// Ultimate Fallback: OpenAI
const { OpenAI } = require('openai');
    let openaiClient;
    try {
        if (process.env.OPENAI_API_KEY) {
            openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        }
    } catch (e) {
        console.warn("OpenAI fallback not configured.");
    }

    async function chatWithGemini(prompt, userRole = 'partner', userLang = 'de', partnerConfig = null, filteredIds = null) {
        if (!ai) {
            return "Lỗi: Chưa cấu hình GROQ_API_KEY. Bạn vui lòng thêm biến môi trường này vào server để AI hoạt động nhé!";
        }

        try {
            // Fetch context (RAG)
            const students = await sheetsService.getAllStudents();
            const partners = await sheetsService.getPartnerAccessConfigs();

            // Filter students based on UI filteredIds or partner config
            let filteredStudents = students.filter(s => s.Status !== 'ARCHIVED');
            
            if (Array.isArray(filteredIds) && filteredIds.length > 0) {
                // If frontend passed filteredIds (what user sees on screen), use it strictly!
                filteredStudents = filteredStudents.filter(s => filteredIds.includes(s.StudentID));
            } else if (userRole === 'partner' && partnerConfig) {
                // Fallback to strict partner access check if no UI filter is provided
                const allowedProfessions = partnerConfig.allowedProfessions ? partnerConfig.allowedProfessions.split(',').map(s => s.trim().toLowerCase()) : [];
                const allowedCenters = partnerConfig.allowedCenters ? partnerConfig.allowedCenters.split(',').map(s => s.trim().toLowerCase()) : [];
                
                filteredStudents = filteredStudents.filter(s => {
                    let pMatch = allowedProfessions.includes('*');
                    if (!pMatch && s.ProfessionCode) {
                        const studentProfs = s.ProfessionCode.split(/[,/]/).map(p => p.trim());
                        pMatch = studentProfs.some(p => allowedProfessions.some(ap => p.toLowerCase().includes(ap)));
                    }
                    const cMatch = allowedCenters.includes('*') || (s.CenterCode && allowedCenters.includes(s.CenterCode.toLowerCase()));
                    return pMatch && cMatch;
                });
            }

            // Prepare context data. Limit fields to avoid massive token usage.
            const studentsContext = filteredStudents.map(s => {
                let birthYear = s.DOB ? s.DOB.split('.').pop() : (s.StudentID ? s.StudentID.split('_').pop().split('.').pop() : 'N/A');
                return `- ID: ${s.StudentID} | Name: ${s.FullName} | Profession: ${s.ProfessionCode || 'N/A'} | NSL Score: ${s.NSLScore || '0'} | NSL Grade: ${s.NSLGrade || 'N/A'} | German Level: ${s.DeutschLevel || 'N/A'} | Available From: ${s.AvailableFrom || 'N/A'} | Birth Year: ${birthYear} | Strengths: ${[s.Strength1, s.Strength2, s.Strength3].filter(Boolean).join(', ')} | YouTubeLink: ${s.YouTubeLink || s['Introduction Video'] || ''}`;
            }).join('\n');

            // --- RAG VECTOR SEARCH ---
            let extraRagContext = "";
            try {
                // We only do vector search if we have the api key
                if (process.env.PINECONE_API_KEY && process.env.OPENAI_API_KEY) {
                    const pineconeService = require('./pinecone');
                    const searchResult = await pineconeService.searchSimilarDocuments(prompt, 3);
                    if (searchResult) {
                        extraRagContext = `\n\n=== RELEVANT INTERVIEW TRANSCRIPTS & CERTIFICATES ===\n${searchResult}\n(Use this extra context to answer specific questions about candidate backgrounds, interviews, or certificates. If asked about something not here, just use the basic candidate list).`;
                    }
                }
            } catch (ragErr) {
                console.error("Vector search failed, continuing with normal DB:", ragErr);
            }

            let systemInstruction = "Your name is Sharkie. You are a smart AI recruiting assistant for NSL Click & Work. Your task is to read the provided database context to answer questions, search, and suggest candidates concisely and accurately.\n\nCRITICAL LANGUAGE RULE: You MUST detect the exact language of the user's prompt. Translate all labels and candidate data (Profession, Strengths) into the detected language before inserting them into the flashcards.\n\nCRITICAL RULE: You MUST ONLY answer based on the provided database context. Do not hallucinate candidates. If you cannot find the answer, politely decline and tell the user to contact newsolution.eu@gmail.com.\n\nCRITICAL FORMATTING RULE: When you suggest candidates, you MUST format EACH candidate as a beautiful HTML flashcard. Use exactly this HTML code (replace bracketed text with data) on a SINGLE LINE so it renders perfectly:\n<div style=\"background: #fff; border: 2px solid #222; border-radius: 8px; padding: 15px; margin: 10px 0; box-shadow: 4px 4px 0px #222; display: flex; align-items: stretch; gap: 15px;\"><img src=\"proxy/students/[ID]/photo\" onerror=\"this.onerror=null; this.src='https://ui-avatars.com/api/?name=[Name]&background=random'\" style=\"width: 70px; height: 70px; border-radius: 50%; object-fit: cover; border: 2px solid #222; flex-shrink: 0;\"><div style=\"flex-grow: 1;\"><h4 style=\"margin: 0 0 5px 0; color: #222; font-weight: 900; font-size: 18px; text-transform: uppercase;\">[Name]</h4><div style=\"font-weight: bold; color: #cc1f1f; font-size: 13px; text-transform: uppercase; margin-bottom: 10px;\">[Profession]</div><div style=\"display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 13px; color: #333; margin-bottom: 10px; border-top: 1px dashed #ccc; border-bottom: 1px dashed #ccc; padding: 8px 0;\"><div><strong>[Label for Birth Year]:</strong> [Birth Year]</div><div><strong>[Label for German]:</strong> [German Level]</div><div><strong>[Label for NSL Score]:</strong> [NSL Score]</div><div><strong>[Label for Rank]:</strong> [NSL Grade]</div><div style=\"grid-column: span 2;\"><strong>[Label for Availability]:</strong> [Available From]</div></div><div style=\"font-size: 13px; color: #333;\"><strong style=\"text-transform: uppercase;\">[Label for Superpowers]:</strong><br>[Strengths (e.g. as <ul><li> list)]</div></div>[VIDEO_BUTTON_HTML]</div>\n\nFor `[VIDEO_BUTTON_HTML]`, IF AND ONLY IF the candidate has a YouTubeLink, replace it with this HTML block: `<div style=\"display: flex; align-items: center; justify-content: center; border-left: 2px dashed #ccc; padding-left: 15px;\"><a href=\"[YouTubeLink]\" target=\"_blank\" style=\"display: inline-block; background: #fff; color: #222; border: 2px solid #222; padding: 10px 15px; text-decoration: none; font-weight: 900; font-size: 12px; text-transform: uppercase; text-align: center; box-shadow: 3px 3px 0px #222; white-space: nowrap;\">[Label for Watch Video]</a></div>`. If they DO NOT have a video, replace `[VIDEO_BUTTON_HTML]` with an empty string. Do NOT use markdown lists (*) for candidates anymore. ONLY use the HTML flashcard above.\n\n";
            
            if (userRole === 'admin') {
                const partnersContext = partners.map(p => `- Name: ${p.partnerName} | Status: ${p.revoked === 'TRUE' ? 'Revoked' : 'Active'} | Professions: ${p.allowedProfessions}`).join('\n');
                systemInstruction += `The user is an ADMIN. You have full access to all data.\n\n=== PARTNERS LIST ===\n${partnersContext}\n\n=== CANDIDATES LIST ===\n${studentsContext}${extraRagContext}`;
            } else {
                systemInstruction += `The user is a PARTNER (RECRUITER). Be professional and help them find candidates.\n\n=== CANDIDATES LIST ===\n${studentsContext}${extraRagContext}`;
            }

            systemInstruction += `\n\nCRITICAL LANGUAGE RULE: You MUST reply in the EXACT language of the user's prompt (if the user asks in Vietnamese, reply entirely in Vietnamese; if English, reply in English; if German, reply in German). DO NOT mix languages. DO NOT output any Chinese characters under any circumstances. Ensure all labels inside the flashcard are translated into the user's language.`;

            systemInstruction += `\n\nCRITICAL TRACKING RULE: At the end of your response, always politely ask the user which candidate they would like to proceed with or select for an interview. If the user EXPLICITLY states they have chosen a candidate in their message, you MUST append a hidden tag at the very end of your response exactly like this: [CHOSEN_CANDIDATE: StudentID] (replace StudentID with the actual ID). Do not output this tag unless a clear choice is made.`;


            let responseText;
            const modelsToTry = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
            let lastError;
            let success = false;

            for (const modelName of modelsToTry) {
                let retries = 2; // Try each model max 2 times
                let delay = 1000;

                while (retries > 0) {
                    try {
                        const response = await ai.chat.completions.create({
                            model: modelName,
                            temperature: 0.2,
                            messages: [
                                { role: "system", content: systemInstruction },
                                { role: "user", content: prompt }
                            ]
                        });
                        responseText = response.choices[0].message.content;
                        success = true;
                        break; // Success for this model
                    } catch (error) {
                        lastError = error;
                        if (error.status === 503 || error.message.includes('503') || error.status === 429) {
                            retries--;
                            if (retries > 0) {
                                console.log(`[${modelName}] quota/503 error. Retrying in ${delay/1000}s...`);
                                await new Promise(res => setTimeout(res, delay));
                                delay *= 2;
                            } else {
                                console.log(`[${modelName}] failed after retries. Falling back to next model...`);
                            }
                        } else {
                            // If it's a 4xx error (e.g., model not found), just break out of retry loop and try next model
                            console.log(`[${modelName}] error: ${error.message}. Falling back to next model...`);
                            break; 
                        }
                    }
                }
                if (success) break;
            }

            if (!success) {
                if (openaiClient) {
                    console.log("All Gemini models failed. Falling back to OpenAI (gpt-4o-mini)...");
                    try {
                        const openAiResponse = await openaiClient.chat.completions.create({
                            model: "gpt-4o-mini",
                            temperature: 0.2,
                            messages: [
                                { role: "system", content: systemInstruction },
                                { role: "user", content: prompt }
                            ]
                        });
                        responseText = openAiResponse.choices[0].message.content;
                        success = true;
                    } catch (openAiError) {
                        console.error("OpenAI fallback also failed:", openAiError);
                        throw new Error("Both Google Gemini and OpenAI fallbacks failed.");
                    }
                } else {
                    throw lastError || new Error("All fallback models failed and OpenAI is not configured.");
                }
            }

            return responseText;
        } catch (error) {
            console.error("AI Generation Error:", error);
            return "Xin lỗi, hệ thống AI hiện đang quá tải hoàn toàn. Vui lòng thử lại sau ít phút hoặc liên hệ newsolution.eu@gmail.com.";
    }
}

module.exports = {
    chatWithGemini
};
