require('dotenv').config();
const { logChatRequest } = require('./services/sheets');

async function test() {
    console.log("Testing logChatRequest locally...");
    const success = await logChatRequest({
        partnerId: 'TEST',
        role: 'admin',
        language: 'en',
        userMessage: 'Test user message',
        botReply: 'Test bot reply',
        chosenCandidate: 'NSL-123'
    });
    console.log("Success?", success);
}
test();
