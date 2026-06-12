const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { getIndex, createEmbedding } = require('./pinecone');

function chunkText(text, maxWords = 500) {
    const words = text.split(/\s+/);
    const chunks = [];
    let currentChunk = [];

    for (const word of words) {
        currentChunk.push(word);
        if (currentChunk.length >= maxWords) {
            chunks.push(currentChunk.join(' '));
            currentChunk = [];
        }
    }
    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
    }
    return chunks;
}

async function extractTextFromPDF(filePath) {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text;
    } catch (error) {
        console.error(`Lỗi đọc file PDF ${filePath}:`, error);
        return "";
    }
}

function extractTextFromTXT(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        console.error(`Lỗi đọc file Text ${filePath}:`, error);
        return "";
    }
}

async function syncSingleDocumentToPinecone(filePath, originalName) {
    console.log(`Đang xử lý file RAG: ${originalName}...`);
    
    const index = await getIndex();
    if (!index) {
        throw new Error("Không thể kết nối tới Pinecone. Vui lòng kiểm tra PINECONE_API_KEY.");
    }

    const ext = path.extname(originalName).toLowerCase();
    let textContent = "";
    
    if (ext === '.pdf') {
        textContent = await extractTextFromPDF(filePath);
    } else if (ext === '.txt' || ext === '.md') {
        textContent = extractTextFromTXT(filePath);
    } else {
        throw new Error(`Không hỗ trợ định dạng này: ${ext}`);
    }

    if (!textContent || textContent.trim().length === 0) {
        throw new Error(`File rỗng hoặc không đọc được chữ.`);
    }

    // Bóc tách Metadata
    let studentId = "Unknown";
    let docType = "Document";
    const fileNameParts = originalName.split('_');
    if (fileNameParts.length >= 2) {
        studentId = fileNameParts[0]; 
        docType = fileNameParts.slice(1).join('_').replace(ext, ''); 
    }

    const chunks = chunkText(textContent);
    console.log(`  -> Đã cắt thành ${chunks.length} mảnh văn bản (chunks).`);

    let lastError = null;
    const vectorsToUpsert = [];
    for (let i = 0; i < chunks.length; i++) {
        const chunkTextContent = chunks[i];
        const chunkId = `${studentId}_${docType}_chunk_${i}_${Date.now()}`;
        
        try {
            const vector = await createEmbedding(chunkTextContent);
            vectorsToUpsert.push({
                id: chunkId,
                values: vector,
                metadata: {
                    studentId: studentId,
                    docType: docType,
                    fileName: originalName,
                    chunkIndex: i,
                    text: chunkTextContent
                }
            });
        } catch (err) {
            console.error(`  -> Lỗi khi tạo Vector cho chunk ${i}:`, err);
            lastError = err;
        }
    }

    if (vectorsToUpsert.length > 0) {
        await index.upsert({ records: vectorsToUpsert });
        return { success: true, chunks: vectorsToUpsert.length };
    } else {
        throw new Error(`Không tạo được vector nào từ file này. Lỗi chi tiết: ${lastError ? lastError.message : 'Unknown'}`);
    }
}

module.exports = {
    syncSingleDocumentToPinecone
};
