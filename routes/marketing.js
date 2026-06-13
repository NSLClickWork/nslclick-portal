const express = require('express');
const router = express.Router();

router.get('/employer', (req, res) => {
    const lang = req.query.lang || req.cookies.lang || 'en';
    if (lang === 'de') {
        return res.render('marketing/employer_de', { lang });
    }
    res.render('marketing/employer', { lang });
});

router.get('/student', (req, res) => {
    const lang = req.query.lang || req.cookies.lang || 'en';
    if (lang === 'de') {
        return res.render('marketing/student_de', { lang });
    }
    res.render('marketing/student', { lang });
});

module.exports = router;
