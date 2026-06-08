const express = require('express');
const router = express.Router();

router.post('/cv', (req, res) => {
    // Make.com sẽ POST data CV mới (link Google Drive, email) vào endpoint này
    console.log('🦈 Nhận được tín hiệu CV mới từ Make.com:', req.body);
    
    // Ở đây có thể kích hoạt bot.js để phân tích tự động
    // và gửi thông báo lên kênh Discord '#recruiting'
    
    res.status(200).json({ success: true, message: 'Đã tiếp nhận CV để xử lý.' });
});

module.exports = router;
