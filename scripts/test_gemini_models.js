const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testModel(modelName) {
    console.log(`Testing model: ${modelName}...`);
    try {
        const model = genAI.getGenerativeModel({ 
            model: modelName,
            generationConfig: { responseMimeType: "application/json" }
        });
        const prompt = `Say hello and return JSON: {"msg": "hello from modelName"}`;
        const result = await model.generateContent(prompt);
        console.log(`Success with ${modelName}:`, result.response.text().trim());
        return true;
    } catch (e) {
        console.error(`Failed with ${modelName}:`, e.message);
        return false;
    }
}

async function run() {
    const models = [
        "gemini-2.0-flash",
        "gemini-flash-latest",
        "gemini-3.5-flash"
    ];
    for (const m of models) {
        const ok = await testModel(m);
        if (ok) {
            console.log(`>>> Recommended model is: ${m}`);
            break;
        }
    }
}

run();
