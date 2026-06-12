const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

let pineconeClient = null;
let genAI = null;

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

function getGemini() {
    if (!genAI) {
        if (!process.env.GEMINI_API_KEY) {
            console.warn("GEMINI_API_KEY is missing. Embeddings will not work.");
            return null;
        }
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return genAI;
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
 * Gọi Gemini để biến một đoạn Text thành dãy số Vector
 */
async function createEmbedding(text) {
    const ai = getGemini();
    if (!ai) return null;

    try {
        const model = ai.getGenerativeModel({ model: "gemini-embedding-2" });
        const result = await model.embedContent({
            content: { parts: [{ text: text.replace(/\n/g, ' ') }] },
            outputDimensionality: 768
        });
        return result.embedding.values;
    } catch (error) {
        console.error("Lỗi khi tạo Embedding bằng Gemini:", error);
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

async function listDocumentsByStudent(studentId) {
    try {
        const index = await getIndex();
        if (!index) return [];

        let results = [];
        let paginationToken;
        do {
            const res = await index.listPaginated({
                prefix: studentId + "_",
                paginationToken: paginationToken
            });
            if (res.vectors && res.vectors.length > 0) {
                results = results.concat(res.vectors.map(v => v.id));
            }
            paginationToken = res.pagination ? res.pagination.next : undefined;
        } while (paginationToken);

        // Parse IDs to group by timestamp and docType
        // Format: `${studentId}_${docType}_chunk_${i}_${timestamp}`
        const sessionsMap = {};
        
        for (const id of results) {
            const parts = id.split('_chunk_');
            if (parts.length === 2) {
                const prefixPart = parts[0]; // e.g. "NSL-12345_ChungChiTiengDuc.txt"
                const docType = prefixPart.substring(studentId.length + 1);
                
                const suffixParts = parts[1].split('_'); // e.g. "0", "1781281346439"
                if (suffixParts.length >= 2) {
                    const timestamp = suffixParts[suffixParts.length - 1];
                    const sessionId = `${docType}_${timestamp}`;
                    
                    if (!sessionsMap[sessionId]) {
                        sessionsMap[sessionId] = {
                            studentId,
                            docType,
                            timestamp: parseInt(timestamp),
                            chunksCount: 0,
                            vectorIds: []
                        };
                    }
                    sessionsMap[sessionId].chunksCount++;
                    sessionsMap[sessionId].vectorIds.push(id);
                }
            }
        }
        
        // Convert to array and sort by timestamp descending
        return Object.values(sessionsMap).sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
        console.error("Lỗi khi liệt kê tài liệu từ Pinecone:", error);
        throw error;
    }
}

async function deleteDocuments(vectorIds) {
    try {
        const index = await getIndex();
        if (!index || !vectorIds || vectorIds.length === 0) return false;
        
        // Delete in batches of 1000
        for (let i = 0; i < vectorIds.length; i += 1000) {
            const batch = vectorIds.slice(i, i + 1000);
            await index.deleteMany(batch);
        }
        return true;
    } catch (error) {
        console.error("Lỗi khi xóa tài liệu khỏi Pinecone:", error);
        throw error;
    }
}

module.exports = {
    getIndex,
    createEmbedding,
    searchSimilarDocuments,
    listDocumentsByStudent,
    deleteDocuments
};
