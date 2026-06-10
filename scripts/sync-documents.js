require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { getIndex, createEmbedding } = require('../services/pinecone');

const UPLOAD_DIR = path.join(__dirname, '../uploads');

/**
 * Chia một đoạn văn bản dài thành các chunk nhỏ hơn (khoảng ~500 từ/chunk)
 * để tránh vượt quá giới hạn Token của Embedding Model.
 */
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

/**
 * Đọc file PDF và trích xuất chữ
 */
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

/**
 * Đọc file Text (txt, md)
 */
function extractTextFromTXT(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        console.error(`Lỗi đọc file Text ${filePath}:`, error);
        return "";
    }
}

/**
 * Hàm chính: Quét thư mục 'uploads', đọc file, tạo Vector và đẩy lên Pinecone
 */
async function syncDocumentsToPinecone() {
    console.log("🚀 Bắt đầu quá trình đồng bộ tài liệu lên Vector Database (Pinecone)...");
    
    const index = await getIndex();
    if (!index) {
        console.error("Không thể kết nối tới Pinecone. Vui lòng kiểm tra PINECONE_API_KEY.");
        return;
    }

    if (!fs.existsSync(UPLOAD_DIR)) {
        console.log(`Thư mục ${UPLOAD_DIR} không tồn tại. Đang tạo mới...`);
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        console.log("Vui lòng copy các file PDF chứng chỉ hoặc file txt biên bản phỏng vấn vào thư mục 'uploads' và chạy lại script.");
        return;
    }

    const files = fs.readdirSync(UPLOAD_DIR);
    if (files.length === 0) {
        console.log("Thư mục 'uploads' đang trống. Không có tài liệu nào để xử lý.");
        return;
    }

    let totalChunksUploaded = 0;

    for (const file of files) {
        const filePath = path.join(UPLOAD_DIR, file);
        const ext = path.extname(file).toLowerCase();
        let textContent = "";
        
        // 1. Phân loại và lấy chữ từ File
        console.log(`Đang xử lý file: ${file}...`);
        if (ext === '.pdf') {
            textContent = await extractTextFromPDF(filePath);
        } else if (ext === '.txt' || ext === '.md') {
            textContent = extractTextFromTXT(filePath);
        } else {
            console.log(`Bỏ qua file ${file} (Không hỗ trợ định dạng này)`);
            continue;
        }

        if (!textContent || textContent.trim().length === 0) {
            console.log(`Cảnh báo: File ${file} rỗng hoặc không đọc được chữ.`);
            continue;
        }

        // 2. Bóc tách Metadata (Mẹo: Đặt tên file theo cấu trúc: NSL-12345_Transcript.pdf)
        let studentId = "Unknown";
        let docType = "Document";
        const fileNameParts = file.split('_');
        if (fileNameParts.length >= 2) {
            studentId = fileNameParts[0]; // Ví dụ: NSL-2601001
            docType = fileNameParts.slice(1).join('_').replace(ext, ''); // Ví dụ: Transcript
        }

        // 3. Cắt nhỏ văn bản (Chunking)
        const chunks = chunkText(textContent);
        console.log(`  -> Đã cắt thành ${chunks.length} mảnh văn bản (chunks).`);

        // 4. Mã hóa (Embedding) và Đẩy lên Pinecone
        const vectorsToUpsert = [];
        for (let i = 0; i < chunks.length; i++) {
            const chunkTextContent = chunks[i];
            const chunkId = `${studentId}_${docType}_chunk_${i}`;
            
            try {
                const vector = await createEmbedding(chunkTextContent);
                vectorsToUpsert.push({
                    id: chunkId,
                    values: vector,
                    metadata: {
                        studentId: studentId,
                        docType: docType,
                        fileName: file,
                        chunkIndex: i,
                        text: chunkTextContent // Lưu luôn chữ gốc để làm ngữ cảnh (Context)
                    }
                });
            } catch (err) {
                console.error(`  -> Lỗi khi tạo Vector cho chunk ${i} của file ${file}`);
            }
        }

        // 5. Upsert batch
        if (vectorsToUpsert.length > 0) {
            try {
                await index.upsert(vectorsToUpsert);
                console.log(`  -> Đã đẩy thành công ${vectorsToUpsert.length} vectors lên Pinecone.`);
                totalChunksUploaded += vectorsToUpsert.length;
            } catch (upsertErr) {
                console.error(`  -> Lỗi khi Upsert dữ liệu lên Pinecone:`, upsertErr);
            }
        }
    }

    console.log(`\n🎉 Hoàn tất! Đã đồng bộ tổng cộng ${totalChunksUploaded} đoạn văn bản lên Pinecone.`);
}

// Chạy script
syncDocumentsToPinecone();
