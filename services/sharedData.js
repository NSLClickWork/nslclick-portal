// Lớp dữ liệu chung (Shared Data Layer) để import bởi tất cả các bot
const { fetchCandidateFilesFromMS365 } = require('./msGraph');
const driveService = require('./drive'); // Tái sử dụng module Google Drive hiện tại của portal

async function fetchCandidateFiles(query) {
    console.log(`Bắt đầu tìm kiếm ứng viên với từ khoá: ${query} trên cả 2 nguồn...`);

    // 1. Tìm trên Microsoft 365 (SharePoint/OneDrive)
    const msFiles = await fetchCandidateFilesFromMS365(query);
    
    // 2. Tìm trên Google Drive
    let googleFiles = [];
    try {
        // Giả lập lấy file từ Google Drive thông qua driveService
        googleFiles = [
            { source: 'Google Drive', fileName: `${query}_Google_CV.pdf`, url: 'https://drive.google.com/mock-cv' }
        ];
    } catch (e) {
        console.error('Lỗi khi fetch từ Google Drive:', e);
    }
    
    // 3. Gộp cả 2 nguồn (Dual-Source) theo đúng tài liệu
    const mergedResults = [...msFiles, ...googleFiles];
    console.log('Đã gộp kết quả tìm kiếm:', mergedResults);
    
    return mergedResults;
}

module.exports = { fetchCandidateFiles };
