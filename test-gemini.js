const geminiService = require('./services/gemini');
require('dotenv').config();

async function test() {
    try {
        console.log("Calling Gemini...");
        const response = await geminiService.chatWithGemini("tìm điều dưỡng", "partner", "de", null, ["1", "2"]);
        console.log("Response:", response);
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
