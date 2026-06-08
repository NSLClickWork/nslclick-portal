async function matchCandidates() {
    // Logic ghép nối ứng viên
    // Sẽ được gọi tới cơ sở dữ liệu chung (Shared Data) để lấy danh sách Job và CV hiện có
    return [
        { candidateId: '123', jobId: 'JOB-456', matchScore: '90%' }
    ];
}

module.exports = { matchCandidates };
