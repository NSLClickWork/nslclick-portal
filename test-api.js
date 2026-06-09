const axios = require('axios');

async function testApi() {
    try {
        const response = await axios.post('http://localhost:3000/api/chat', {
            prompt: "hello",
            role: "partner",
            filteredIds: ["NSL-2601001", "HDEU_TAM_HUYNH_06.01.2004"]
        });
        console.log("API Response:", response.data);
    } catch (e) {
        console.error("API Error:", e.response ? e.response.data : e.message);
    }
}

testApi();
