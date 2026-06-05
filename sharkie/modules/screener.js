const { OpenAI } = require('openai');

let openai;
if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function analyzeCV(cvUrl) {
    // 1. Ở bước thực tế, chúng ta sẽ tải file PDF từ cvUrl về và trích xuất text (ví dụ dùng pdf-parse).
    // Ở đây ta giả lập logic text extraction.
    const mockExtractedText = "Tên: Nguyễn Văn A, Kinh nghiệm: 2 năm làm sale, Điểm mạnh: giao tiếp tốt...";
    
    if (!process.env.OPENAI_API_KEY) {
        console.log("No OPENAI_API_KEY, returning mock data");
        return { score: 8, summary: 'Kinh nghiệm 2 năm, phù hợp với vị trí Sale (Mock data)' };
    }

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-5.5-instant",
            messages: [
                { role: "system", content: "Bạn là một chuyên gia tuyển dụng. Hãy chấm điểm CV ứng viên trên thang 10, liệt kê 3 điểm mạnh và 1 cờ đỏ (red flag - nếu có)." },
                { role: "user", content: `Hãy phân tích CV sau:\n${mockExtractedText}` }
            ]
        });

        const reply = response.choices[0].message.content;
        return {
            score: 8, // Có thể parse điểm từ reply
            summary: reply
        };
    } catch (error) {
        console.error("Lỗi khi gọi OpenAI API:", error);
        throw error;
    }
}

module.exports = { analyzeCV };
