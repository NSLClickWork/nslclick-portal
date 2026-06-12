const axios = require('axios');

async function testProd() {
    try {
        console.log("Sending POST request to prod...");
        const response = await axios.post('https://personalkampagne-portal.de/api/chat/message', {
            message: "Tôi chọn Nhu"
        }, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            }
        });
        
        console.log("Response:", response.status);
    } catch (e) {
        console.error("Error status:", e.response ? e.response.status : e.message);
        console.error("Headers:", e.response ? e.response.headers : 'No headers');
        if (e.response && e.response.status === 404) {
            console.error("Body:", e.response.data);
        }
    }
}

testProd();
