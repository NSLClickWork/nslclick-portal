const axios = require('axios');

async function testProd() {
    try {
        console.log("Sending POST request to prod...");
        const response = await axios.post('https://personalkampagne-portal.de/api/chat/message', {
            message: "TEST_MESSAGE_PLEASE_IGNORE"
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log("Response:", response.status);
        console.log("Data:", response.data.reply ? response.data.reply.substring(0, 50) + "..." : response.data);
    } catch (e) {
        console.error("Error:", e.message);
    }
}

testProd();
