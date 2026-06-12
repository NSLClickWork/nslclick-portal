const express = require('express');
const router = express.Router();

router.get('/employer', (req, res) => {
    res.render('marketing/employer');
});

router.get('/student', (req, res) => {
    res.render('marketing/student');
});

module.exports = router;
