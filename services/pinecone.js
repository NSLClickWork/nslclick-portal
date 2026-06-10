const { Pinecone } = require('@pinecone-database/pinecone');
const { OpenAI } = require('openai');
require('dotenv').config();

let pineconeClient = null;
let openaiClient = null;

function getPinecone() {
    if (!pineconeClient) {
        if (!process.env.PINECONE_API_KEY) {
            console.warn("PINECONE_API_KEY is missing. RAG features will be disabled.");
            return null;
        }
        pineconeClient = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY,
        });
    }
    return pineconeClient;
}

function getOpenAI() {
    if (!openaiClient) {
        if (!process.env.OPENAI_API_KEY) {
            console.warn("OPENAI_API_KEY is missing. Embeddings will not work.");
            return null;
        }
        openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return openaiClient;
}

/**
 * Mở kết nối đến Index của Pinecone
 */
async function getIndex() {
    const pc = getPinecone();
    if (!pc) return null;
    
    const indexName = process.env.PINECONE_INDEX_NAME || 'nsl-candidates';
    return pc.index(indexName);
}

/**
 * Gọi OpenAI để biến một đoạn Text thành dãy số Vector
 */
async function createEmbedding(text) {
    const openai = getOpenAI();
    if (!openai) return null;

    try {
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small", // Model nhúng rẻ và tốt nhất hiện nay
            input: text.replace(/\n/g, ' '),
            encoding_format: "float",
        });
        return response.data[0].embedding;
    } catch (error) {
        console.error("Lỗi khi tạo Embedding:", error);
        throw error;
    }
}

/**
 * Tìm kiếm các tài liệu liên quan nhất dựa trên câu hỏi của khách hàng
 */
async function searchSimilarDocuments(queryText, topK = 3) {
    try {
        const index = await getIndex();
        if (!index) return "";

        // 1. Chuyển câu hỏi thành Vector
        const queryVector = await createEmbedding(queryText);
        if (!queryVector) return "";

        // 2. Quét Vector DB để tìm các đoạn text khớp nhất
        const searchResults = await index.query({
            vector: queryVector,
            topK: topK,
            includeMetadata: true
        });

        // 3. Trích xuất text từ kết quả trả về
        if (searchResults.matches && searchResults.matches.length > 0) {
            const contextText = searchResults.matches.map(match => {
                const meta = match.metadata || {};
                return `[Tài liệu của ${meta.studentId || 'Ứng viên'} - ${meta.docType || 'Hồ sơ'}]: ${meta.text || ''}`;
            }).join('\n\n');
            return contextText;
        }
        return "";
    } catch (error) {
        console.error("Lỗi khi tìm kiếm Vector DB:", error);
        return "";
    }
}

module.exports = {
    getIndex,
    createEmbedding,
    searchSimilarDocuments
};
